import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRegistrationHandler } from '../netlify/functions/register-account.mjs'

class MemoryRateLimitStore {
  constructor() {
    this.entries = new Map()
    this.version = 0
  }

  async getWithMetadata(key) {
    const entry = this.entries.get(key)
    return entry ? structuredClone(entry) : null
  }

  async setJSON(key, data, options = {}) {
    const existing = this.entries.get(key)
    const canWrite = options.onlyIfNew
      ? !existing
      : options.onlyIfMatch
        ? existing?.etag === options.onlyIfMatch
        : true

    if (!canWrite) return { modified: false }

    const etag = `etag-${++this.version}`
    this.entries.set(key, { data: structuredClone(data), etag, metadata: {} })
    return { modified: true, etag }
  }
}

const productionEnv = {
  ROACHNET_SUPABASE_URL: 'https://project.supabase.co',
  ROACHNET_SUPABASE_ANON_KEY: 'public-anon-key',
  ROACHNET_TURNSTILE_SECRET_KEY: 'turnstile-secret',
  ROACHNET_AUTH_REDIRECT_URL: 'https://accounts.roachnet.org/',
}

function registrationRequest({
  origin = 'https://accounts.roachnet.org',
  ip = '203.0.113.9',
  email = 'person@example.com',
  captchaToken = 'captcha-token',
} = {}) {
  const headers = { 'content-type': 'application/json' }
  if (origin !== null) headers.origin = origin
  if (ip !== null) headers['x-nf-client-connection-ip'] = ip

  return new Request('https://roachnet.org/.netlify/functions/register-account', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password: 'long-enough-password',
      displayName: 'Person',
      captchaToken,
      company: '',
      startedAt: '1',
    }),
  })
}

function createHarness({ env = productionEnv, store = new MemoryRateLimitStore(), fetchImpl, signupTimeoutMs } = {}) {
  const calls = []
  const fetchStub = fetchImpl || (async (url, options) => {
    calls.push({ url: String(url), options })
    if (new URL(String(url)).hostname === 'challenges.cloudflare.com') {
      return Response.json({ success: true })
    }
    return Response.json({ id: 'user-1' })
  })

  return {
    calls,
    handler: createRegistrationHandler({
      env,
      fetchImpl: fetchStub,
      getRateLimitStore: () => store,
      now: () => Date.parse('2026-08-22T12:00:00.000Z'),
      ...(signupTimeoutMs ? { signupTimeoutMs } : {}),
    }),
    store,
  }
}

async function body(response) {
  return response.json()
}

test('registration rejects a missing Origin before external work', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(registrationRequest({ origin: null }))

  assert.equal(response.status, 403)
  assert.equal((await body(response)).message, 'Origin not allowed.')
  assert.equal(calls.length, 0)
})

test('production registration fails closed when Turnstile is not configured', async () => {
  const { calls, handler } = createHarness({
    env: {
      ROACHNET_SUPABASE_URL: productionEnv.ROACHNET_SUPABASE_URL,
      ROACHNET_SUPABASE_ANON_KEY: productionEnv.ROACHNET_SUPABASE_ANON_KEY,
    },
  })
  const response = await handler(registrationRequest())

  assert.equal(response.status, 503)
  assert.equal((await body(response)).code, 'captcha_unavailable')
  assert.equal(calls.length, 0)
})

test('production registration requires and verifies a Turnstile token', async () => {
  const missing = createHarness()
  const missingResponse = await missing.handler(registrationRequest({ captchaToken: '' }))
  assert.equal(missingResponse.status, 400)
  assert.equal((await body(missingResponse)).code, 'captcha_required')
  assert.equal(missing.calls.length, 0)

  const invalid = createHarness({
    fetchImpl: async () => Response.json({ success: false }),
  })
  const invalidResponse = await invalid.handler(registrationRequest())
  assert.equal(invalidResponse.status, 403)
  assert.equal((await body(invalidResponse)).code, 'captcha_failed')
})

test('local Turnstile bypass requires an exact local Origin and explicit Netlify dev opt-in', async () => {
  const env = {
    ROACHNET_SUPABASE_URL: productionEnv.ROACHNET_SUPABASE_URL,
    ROACHNET_SUPABASE_ANON_KEY: productionEnv.ROACHNET_SUPABASE_ANON_KEY,
    ROACHNET_ALLOW_LOCAL_REGISTRATION_BYPASS: '1',
    NETLIFY_DEV: 'true',
  }
  const local = createHarness({ env })
  const localResponse = await local.handler(
    registrationRequest({ origin: 'http://localhost:8888', ip: null, captchaToken: '' })
  )
  assert.equal(localResponse.status, 200)

  const deployed = createHarness({ env: { ...env, NETLIFY_DEV: 'false' } })
  const deployedResponse = await deployed.handler(
    registrationRequest({ origin: 'http://localhost:8888', ip: null, captchaToken: '' })
  )
  assert.equal(deployedResponse.status, 403)
  assert.equal((await body(deployedResponse)).message, 'Origin not allowed.')
  assert.equal(deployed.calls.length, 0)
})

test('a deployed function does not answer localhost origins', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(registrationRequest({ origin: 'http://localhost:8888' }))
  assert.equal(response.status, 403)
  assert.equal(calls.length, 0)
})

test('registration refuses oversized bodies and over-long passwords before external work', async () => {
  const { calls, handler } = createHarness()
  const huge = new Request('https://roachnet.org/.netlify/functions/register-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://accounts.roachnet.org', 'x-nf-client-connection-ip': '203.0.113.9' },
    body: JSON.stringify({ email: 'person@example.com', password: 'x'.repeat(20000) }),
  })
  assert.equal((await handler(huge)).status, 413)

  const long = new Request('https://roachnet.org/.netlify/functions/register-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://accounts.roachnet.org', 'x-nf-client-connection-ip': '203.0.113.9' },
    body: JSON.stringify({ email: 'person@example.com', password: 'x'.repeat(73), captchaToken: 'captcha-token' }),
  })
  const longResponse = await handler(long)
  assert.equal(longResponse.status, 400)
  assert.match((await body(longResponse)).message, /72 characters/)
  assert.equal(calls.length, 0)
})

test('a Turnstile pass from another hostname does not count', async () => {
  const { handler } = createHarness({
    fetchImpl: async (url) =>
      new URL(String(url)).hostname === 'challenges.cloudflare.com'
        ? Response.json({ success: true, hostname: 'evil.example' })
        : Response.json({ id: 'user-1' }),
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 403)
  assert.equal((await body(response)).code, 'captcha_failed')
})

test('registration fails closed without a trusted production client IP', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(registrationRequest({ ip: null }))

  assert.equal(response.status, 503)
  assert.equal((await body(response)).code, 'rate_limit_unavailable')
  assert.equal(calls.filter(({ url }) => url.includes('/auth/v1/signup')).length, 0)
})

test('registration fails closed when the durable limiter is unavailable', async () => {
  const { calls, handler } = createHarness({
    store: {
      async getWithMetadata() {
        throw new Error('blob store unavailable')
      },
    },
  })
  const response = await handler(registrationRequest())

  assert.equal(response.status, 503)
  assert.equal((await body(response)).code, 'rate_limit_unavailable')
  assert.equal(calls.filter(({ url }) => url.includes('/auth/v1/signup')).length, 0)
})

test('durable limiter blocks the fourth hourly attempt for one email', async () => {
  const harness = createHarness()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await harness.handler(registrationRequest({ captchaToken: `captcha-${attempt}` }))
    assert.equal(response.status, 200)
  }

  const blocked = await harness.handler(registrationRequest({ captchaToken: 'captcha-4' }))
  assert.equal(blocked.status, 429)
  assert.equal((await body(blocked)).code, 'rate_limited')
  assert.equal(harness.calls.filter(({ url }) => url.includes('/auth/v1/signup')).length, 3)
})

test('registration uses public Supabase signup and returns confirmation semantics', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(registrationRequest())
  const result = await body(response)
  const signupCall = calls.find(({ url }) => url.includes('/auth/v1/signup'))

  assert.equal(response.status, 200)
  assert.equal(result.requiresConfirmation, true)
  assert.match(result.message, /confirm/i)
  assert.ok(signupCall)
  assert.equal(
    signupCall.url,
    'https://project.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Faccounts.roachnet.org%2F'
  )
  assert.equal(signupCall.options.headers.apikey, 'public-anon-key')
  assert.equal(signupCall.options.headers.authorization, 'Bearer public-anon-key')
  assert.deepEqual(JSON.parse(signupCall.options.body), {
    email: 'person@example.com',
    password: 'long-enough-password',
    data: { display_name: 'Person' },
  })
  assert.equal(calls.some(({ url }) => url.includes('/auth/v1/admin/users')), false)
})

test('an address that already has an account gets the same answer as a new one', async () => {
  const { handler } = createHarness({
    fetchImpl: async (url) => {
      if (new URL(String(url)).hostname === 'challenges.cloudflare.com') {
        return Response.json({ success: true, hostname: 'accounts.roachnet.org' })
      }
      return Response.json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, { status: 422 })
    },
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.ok, true)
  assert.equal(result.requiresConfirmation, true)
  assert.doesNotMatch(JSON.stringify(result), /exists|already/i)
})

test('a password found in a breach is refused before sign-up, and only a hash prefix leaves the function', async () => {
  const { createHash } = await import('node:crypto')
  const digest = createHash('sha1').update('long-enough-password').digest('hex').toUpperCase()
  const calls = []
  const { handler } = createHarness({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      const host = new URL(String(url)).hostname
      if (host === 'challenges.cloudflare.com') return Response.json({ success: true })
      if (host === 'api.pwnedpasswords.com') return new Response(`0000000000000000000000000000000000A:0\r\n${digest.slice(5)}:42\r\n`)
      return Response.json({ id: 'user-1' })
    },
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 400)
  assert.equal((await body(response)).code, 'password_breached')
  const range = calls.find(({ url }) => url.includes('api.pwnedpasswords.com'))
  assert.equal(range.url, `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`)
  assert.equal(range.options.headers['add-padding'], 'true')
  assert.equal(calls.some(({ url }) => url.includes('/auth/v1/signup')), false)
  assert.equal(calls.some(({ url, options }) => url.includes(digest.slice(5)) || String(options?.body || '').includes('long-enough-password') && url.includes('pwned')), false)
})

test('sign-up carries on when the breach check is unavailable', async () => {
  const { handler } = createHarness({
    fetchImpl: async (url) => {
      const host = new URL(String(url)).hostname
      if (host === 'challenges.cloudflare.com') return Response.json({ success: true })
      if (host === 'api.pwnedpasswords.com') return new Response('busy', { status: 503 })
      return Response.json({ id: 'user-1' })
    },
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 200)
})

test('with a ticket secret, sign-up sends a ticket the database hook can verify', async () => {
  const { createHmac } = await import('node:crypto')
  const secret = 'ticket-secret-for-tests-0123456789abcdef'
  const { calls, handler } = createHarness({ env: { ...productionEnv, ROACHNET_SIGNUP_TICKET_SECRET: secret } })
  const response = await handler(registrationRequest({ email: 'Person@Example.com' }))
  assert.equal(response.status, 200)
  const signup = calls.find(({ url }) => url.includes('/auth/v1/signup'))
  const { data } = JSON.parse(signup.options.body)
  const [version, expires, mac] = data.signup_ticket.split('.')
  assert.equal(version, 'v1')
  assert.equal(Number(expires), Math.floor(Date.parse('2026-08-22T12:00:00.000Z') / 1000) + 600)
  assert.equal(mac, createHmac('sha256', secret).update(`v1|person@example.com|${expires}`).digest('hex'))
  assert.equal(data.display_name, 'Person')
})

// The human check and the breach check pass; `answer` plays Supabase's sign-up.
function signupAnswering(answer) {
  return async (url, options) => {
    const host = new URL(String(url)).hostname
    if (host === 'challenges.cloudflare.com') return Response.json({ success: true })
    if (host === 'api.pwnedpasswords.com') return new Response('')
    return answer(url, options)
  }
}

test('a sign-up Supabase sits on is answered plainly, with CORS, before the browser gives up', async () => {
  const { handler } = createHarness({
    signupTimeoutMs: 30,
    fetchImpl: signupAnswering(
      (url, options) =>
        new Promise((resolve, reject) => {
          const fallback = setTimeout(() => resolve(Response.json({ id: 'too-late' })), 2000)
          options.signal.addEventListener('abort', () => {
            clearTimeout(fallback)
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
    ),
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 504)
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://accounts.roachnet.org')
  const result = await body(response)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'signup_slow')
  assert.match(result.message, /slow on our side/)
})

test("Supabase's own failures get a plain answer, not its wording", async () => {
  const cases = [
    [Response.json({ message: 'An invalid response was received from the upstream server' }, { status: 504 }), 504, 'signup_slow'],
    [Response.json({ code: 504, error_code: 'request_timeout', msg: 'Processing this request timed out' }, { status: 504 }), 504, 'signup_slow'],
    [Response.json({ code: 500, error_code: 'unexpected_failure', msg: 'Error sending confirmation email' }, { status: 500 }), 503, 'signup_email_failed'],
    [new Response('<html>bad gateway</html>', { status: 502 }), 503, 'signup_unavailable'],
  ]
  for (const [answer, status, code] of cases) {
    const { handler } = createHarness({ fetchImpl: signupAnswering(async () => answer.clone()) })
    const response = await handler(registrationRequest())
    assert.equal(response.status, status)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://accounts.roachnet.org')
    const result = await body(response)
    assert.equal(result.code, code)
    assert.doesNotMatch(result.message, /upstream|unexpected|Error sending|bad gateway|timed out/i)
  }
})

test("the database hook's refusal reaches the person as it was written", async () => {
  const { handler } = createHarness({
    fetchImpl: signupAnswering(async () =>
      Response.json({ code: 403, error_code: 'unexpected_failure', msg: 'Create your account at accounts.roachnet.org.' }, { status: 403 })
    ),
  })
  const response = await handler(registrationRequest())
  assert.equal(response.status, 403)
  assert.equal((await body(response)).message, 'Create your account at accounts.roachnet.org.')
})
