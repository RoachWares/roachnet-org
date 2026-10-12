import { createHash, createHmac } from 'node:crypto'
import { getStore } from '@netlify/blobs'

// Browsers on these origins may call the function. The localhost origins only
// count under `netlify dev`, so a deployed function never answers them.
const productionOrigins = new Set([
  'https://accounts.roachnet.org',
  'https://roachnet.org',
])

const localOrigins = new Set([
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:3000',
])

// Turnstile reports the hostname the widget was solved on.
const turnstileHostnames = new Set(['accounts.roachnet.org', 'roachnet.org'])

const maxBodyBytes = 16 * 1024
const maxPasswordLength = 72

const rateLimitRules = [
  { scope: 'ip', limit: 5, windowMs: 15 * 60 * 1000 },
  { scope: 'email', limit: 3, windowMs: 60 * 60 * 1000 },
]

function requestOrigin(request) {
  return request.headers.get('origin') || ''
}

function isDevelopment(env) {
  return env.NETLIFY_DEV === 'true'
}

function isAllowedOrigin(origin, env) {
  return productionOrigins.has(origin) || (isDevelopment(env) && localOrigins.has(origin))
}

function isAllowedRequestOrigin(request, env) {
  return isAllowedOrigin(requestOrigin(request), env)
}

function isLocalBypassEnabled(origin, env) {
  return (
    localOrigins.has(origin) &&
    isDevelopment(env) &&
    env.ROACHNET_ALLOW_LOCAL_REGISTRATION_BYPASS === '1'
  )
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

function withCors(request, response) {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', requestOrigin(request))
  headers.set('access-control-allow-methods', 'POST, OPTIONS')
  headers.set('access-control-allow-headers', 'content-type')
  headers.set('vary', 'origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function clientIp(request, localBypass) {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip')?.trim() || ''
  if (netlifyIp) return netlifyIp
  if (!localBypass) return ''
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local-development'
}

function rateLimitKey(secret, scope, value) {
  return `${scope}:${createHmac('sha256', secret).update(value).digest('hex')}`
}

async function consumeRateLimit({ store, key, limit, windowMs, now }) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const entry = await store.getWithMetadata(key, {
      consistency: 'strong',
      type: 'json',
    })

    if (!entry) {
      const resetAt = now + windowMs
      const result = await store.setJSON(
        key,
        { count: 1, resetAt },
        { onlyIfNew: true }
      )
      if (result.modified) return { allowed: true, retryAfterSeconds: 0 }
      continue
    }

    const count = Number(entry.data?.count)
    const resetAt = Number(entry.data?.resetAt)
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(resetAt)) {
      throw new Error('Invalid registration rate-limit state.')
    }

    if (now < resetAt && count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    }

    const nextState =
      now >= resetAt
        ? { count: 1, resetAt: now + windowMs }
        : { count: count + 1, resetAt }
    const result = await store.setJSON(key, nextState, { onlyIfMatch: entry.etag })
    if (result.modified) return { allowed: true, retryAfterSeconds: 0 }
  }

  throw new Error('Registration rate-limit contention did not settle.')
}

async function verifyTurnstile({ fetchImpl, secret, token, remoteip }) {
  const body = new URLSearchParams({
    secret,
    response: token,
  })

  if (remoteip) body.set('remoteip', remoteip)

  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    return { success: false, message: "The human check service didn't answer. Wait a minute and try again." }
  }

  const result = await response.json()
  const hostnameOk = !result.hostname || turnstileHostnames.has(String(result.hostname))
  const success = result.success === true && hostnameOk
  return {
    success,
    message: success ? '' : "The human check didn't pass. Do it again, then press Create account.",
  }
}

// Supabase's own breached-password check needs the Pro plan, so the function
// does it: the k-anonymity range API only ever sees the first five hex digits
// of the password's SHA-1, and padded answers hide which suffix matched.
// Returns true (breached), false (not found) or null (couldn't check).
export async function passwordIsBreached({ fetchImpl, password, timeoutMs = 2500 }) {
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = digest.slice(0, 5)
  const suffix = digest.slice(5)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'add-padding': 'true', 'user-agent': 'roachnet-register-account' },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const text = await response.text()
    for (const line of text.split('\n')) {
      const [hash, count] = line.trim().split(':')
      if (hash === suffix && Number(count) > 0) return true
    }
    return false
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// A ticket the database's before-user-created hook checks, so a sign-up that
// skipped this function (and its human check, rate limits and breach check)
// is refused. Bound to the email address, good for ten minutes.
export function signupTicket(secret, email, nowMs) {
  const expires = Math.floor(nowMs / 1000) + 600
  const mac = createHmac('sha256', secret).update(`v1|${email}|${expires}`).digest('hex')
  return `v1.${expires}.${mac}`
}

function confirmationRedirect(env) {
  const fallback = 'https://accounts.roachnet.org/'
  try {
    const configured = new URL(env.ROACHNET_AUTH_REDIRECT_URL || fallback)
    return isAllowedOrigin(configured.origin, env) ? configured.href : fallback
  } catch {
    return fallback
  }
}

export function createRegistrationHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  getRateLimitStore = () => getStore('roachnet-registration-rate-limits'),
  now = Date.now,
} = {}) {
  return async (request) => {
    if (!isAllowedRequestOrigin(request, env)) {
      return json({ ok: false, message: 'Origin not allowed.' }, 403)
    }

    if (request.method === 'OPTIONS') {
      return withCors(request, json({ ok: true }))
    }

    if (request.method !== 'POST') {
      return withCors(request, json({ ok: false, message: 'Use POST for account creation.' }, 405))
    }

    const supabaseUrl = String(env.ROACHNET_SUPABASE_URL || '').replace(/\/$/, '')
    const anonKey = env.ROACHNET_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !anonKey) {
      return withCors(
        request,
        json(
          {
            ok: false,
            message: "Sign-up isn't available right now. You can still sign in to an existing account; try sign-up again later.",
          },
          503
        )
      )
    }

    let payload
    try {
      const raw = await request.text()
      if (raw.length > maxBodyBytes) {
        return withCors(request, json({ ok: false, message: 'That request is too large.' }, 413))
      }
      payload = JSON.parse(raw)
    } catch {
      return withCors(request, json({ ok: false, message: 'Send valid JSON.' }, 400))
    }

    const email = String(payload?.email || '').trim().toLowerCase()
    const password = String(payload?.password || '')
    const displayName = String(payload?.displayName || '').trim()
    const honeypot = String(payload?.company || '').trim()
    const captchaToken = String(payload?.captchaToken || '').trim()
    const startedAt = Number(payload?.startedAt || 0)

    if (honeypot) {
      return withCors(request, json({ ok: false, message: "That sign-up didn't go through. Reload the page and try again." }, 400))
    }

    if (!validateEmail(email)) {
      return withCors(request, json({ ok: false, message: 'That email address looks incomplete. Check it and try again.' }, 400))
    }

    if (password.length < 10) {
      return withCors(
        request,
        json({ ok: false, message: 'Use a password with at least 10 characters.' }, 400)
      )
    }

    if (password.length > maxPasswordLength) {
      return withCors(
        request,
        json({ ok: false, message: `Use a password of ${maxPasswordLength} characters or fewer.` }, 400)
      )
    }

    if (displayName.length > 60) {
      return withCors(
        request,
        json({ ok: false, message: 'Keep the name to 60 characters or fewer.' }, 400)
      )
    }

    if (startedAt && now() - startedAt < 900) {
      return withCors(
        request,
        json({ ok: false, message: 'Hold for a second and try again.' }, 429)
      )
    }

    const origin = requestOrigin(request)
    const localBypass = isLocalBypassEnabled(origin, env)
    const turnstileSecret = env.ROACHNET_TURNSTILE_SECRET_KEY || ''
    const remoteip = clientIp(request, localBypass)

    if (!localBypass) {
      if (!turnstileSecret) {
        return withCors(
          request,
          json(
            {
              ok: false,
              code: 'captcha_unavailable',
              message: 'Sign-up is paused until the human check is set up. You can still sign in to an existing account.',
            },
            503
          )
        )
      }

      if (!captchaToken) {
        return withCors(
          request,
          json({ ok: false, code: 'captcha_required', message: 'Finish the human check first.' }, 400)
        )
      }

      let captcha
      try {
        captcha = await verifyTurnstile({
          fetchImpl,
          secret: turnstileSecret,
          token: captchaToken,
          remoteip,
        })
      } catch {
        return withCors(
          request,
          json(
            {
              ok: false,
              code: 'captcha_unavailable',
              message: "The human check service didn't answer. Wait a minute and try again.",
            },
            503
          )
        )
      }

      if (!captcha.success) {
        return withCors(
          request,
          json({ ok: false, code: 'captcha_failed', message: captcha.message }, 403)
        )
      }
    }

    if (!remoteip) {
      return withCors(
        request,
        json(
          {
            ok: false,
            code: 'rate_limit_unavailable',
            message: "Sign-up can't run safely right now. Try again in a few minutes.",
          },
          503
        )
      )
    }

    try {
      const store = getRateLimitStore()
      const keySecret = turnstileSecret || 'local-development-only'
      const values = { ip: remoteip, email }
      for (const rule of rateLimitRules) {
        const result = await consumeRateLimit({
          store,
          key: rateLimitKey(keySecret, rule.scope, values[rule.scope]),
          limit: rule.limit,
          windowMs: rule.windowMs,
          now: now(),
        })
        if (!result.allowed) {
          return withCors(
            request,
            json(
              {
                ok: false,
                code: 'rate_limited',
                message: 'Too many sign-up attempts. Wait up to an hour and try again, or check your inbox for a confirmation link.',
              },
              429,
              { 'retry-after': String(result.retryAfterSeconds) }
            )
          )
        }
      }
    } catch {
      return withCors(
        request,
        json(
          {
            ok: false,
            code: 'rate_limit_unavailable',
            message: 'Sign-up is unavailable for a moment. Try again in a few minutes.',
          },
          503
        )
      )
    }

    const breached = await passwordIsBreached({ fetchImpl, password })
    if (breached === true) {
      return withCors(
        request,
        json(
          {
            ok: false,
            code: 'password_breached',
            message: "That password has turned up in a data breach, so it isn't safe to use. Pick a different one.",
          },
          400
        )
      )
    }
    if (breached === null) {
      console.warn('register-account: the breached-password check was unavailable; sign-up continued without it.')
    }

    const userData = { display_name: displayName || email.split('@')[0] }
    if (env.ROACHNET_SIGNUP_TICKET_SECRET) {
      userData.signup_ticket = signupTicket(env.ROACHNET_SIGNUP_TICKET_SECRET, email, now())
    }

    const signupUrl = new URL(`${supabaseUrl}/auth/v1/signup`)
    signupUrl.searchParams.set('redirect_to', confirmationRedirect(env))

    let createResponse
    try {
      createResponse = await fetchImpl(signupUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          data: userData,
        }),
      })
    } catch {
      return withCors(
        request,
        json({ ok: false, message: "Sign-up couldn't reach the account service. Try again in a few minutes." }, 503)
      )
    }

    const responseBody = await createResponse.json().catch(() => ({}))

    if (!createResponse.ok) {
      const code = String(responseBody?.error_code || responseBody?.code || '')
      const message = String(responseBody?.msg || responseBody?.message || responseBody?.error || '')
      const lowered = `${code} ${message}`.toLowerCase()

      // Answer an existing address exactly like a new one, so sign-up can't be
      // used to find out who has an account. Supabase does the same when email
      // confirmation is on; this covers the case where it is switched off.
      if (lowered.includes('user_already_exists') || lowered.includes('already registered')) {
        return withCors(
          request,
          json({ ok: true, requiresConfirmation: true, message: 'Check your email to confirm your account, then sign in.', userId: null })
        )
      }

      return withCors(
        request,
        json(
          {
            ok: false,
            message: message || "Sign-up didn't go through. Try again in a few minutes.",
          },
          createResponse.status
        )
      )
    }

    const requiresConfirmation = !responseBody?.access_token
    return withCors(
      request,
      json({
        ok: true,
        requiresConfirmation,
        message: requiresConfirmation
          ? 'Check your email to confirm your account, then sign in.'
          : 'Account created. Sign in to continue.',
        userId: responseBody?.user?.id || responseBody?.id || null,
      })
    )
  }
}

export default async (request) => createRegistrationHandler()(request)
