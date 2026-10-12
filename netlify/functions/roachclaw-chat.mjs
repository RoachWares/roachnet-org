import { mkdir } from 'node:fs/promises'
import { getStore } from '@netlify/blobs'

const productionOrigins = new Set(['https://roachnet.org', 'https://accounts.roachnet.org'])

// Only `netlify dev` answers these.
const localOrigins = new Set([
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:3000',
])

const maxBodyBytes = 64 * 1024
const threadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Each reply costs a model run and four database writes, so every signed-in
// account gets a budget.
const chatRateLimitRules = [
  { scope: 'burst', limit: 20, windowMs: 10 * 60 * 1000 },
  { scope: 'day', limit: 200, windowMs: 24 * 60 * 60 * 1000 },
]

// Messages written here are safe to show the person; anything else is logged
// and replaced with a generic line so database details never reach a browser.
class PublicError extends Error {}

function isAllowedOrigin(origin, env) {
  return productionOrigins.has(origin) || (env.NETLIFY_DEV === 'true' && localOrigins.has(origin))
}

function isAllowedRequestOrigin(request, env) {
  const origin = request.headers.get('origin') || ''
  return !origin || isAllowedOrigin(origin, env)
}

const defaultSystemPrompt =
  'You are RoachClaw on the RoachNet web lane. Answer clearly, keep user data isolated to the authenticated account lane, never claim access to a local machine you cannot see, and prefer practical help over filler.'
const roachBrainCacheDir = '/tmp/roachbrain-cloud-cache'
// The hosted model is pinned to one Hugging Face commit, so a change upstream
// can't swap what answers. SmolLM2 is Apache-2.0. q8 (137 MB) downloads faster
// than q4 (182 MB, unquantized embeddings) and answers about as quickly on CPU.
const roachBrainModel = {
  id: 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA',
  revision: '5b6682c7c9df18f004bfb7e635cba3f3d98537d8',
  label: 'SmolLM2 135M',
  dtypes: ['q8', 'q4'],
}
// A cold function downloads and loads the model before it can answer. Netlify
// stops a synchronous function at 30 seconds, so a reply waits this long for
// the model and otherwise says the lane is still waking up.
const modelWaitMs = 20_000

let roachBrainPipelinePromise = null

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function normalizeOrigin(request, env) {
  const origin = request.headers.get('origin') || ''
  if (isAllowedOrigin(origin, env)) {
    return origin
  }

  return 'https://roachnet.org'
}

function withCors(request, response, env) {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', normalizeOrigin(request, env))
  headers.set('access-control-allow-methods', 'POST, OPTIONS')
  headers.set('access-control-allow-headers', 'content-type, authorization')
  headers.set('vary', 'origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return ''
  }

  return token.trim()
}

function sanitizeMessageContent(value) {
  const text = String(value || '').trim()
  return text.slice(0, 12000)
}

function sanitizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function normalizeBridgeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function isAllowedBridgeUrl(bridgeUrl, allowedOrigins) {
  if (!bridgeUrl || !allowedOrigins.size) {
    return false
  }

  return allowedOrigins.has(bridgeUrl)
}

function summarizePrompt(prompt) {
  const flattened = prompt.replace(/\s+/g, ' ').trim()
  if (!flattened) {
    return 'New chat'
  }

  return flattened.length > 64 ? `${flattened.slice(0, 61)}...` : flattened
}

function summarizeReply(reply) {
  const flattened = reply.replace(/\s+/g, ' ').trim()
  return flattened.length > 180 ? `${flattened.slice(0, 177)}...` : flattened
}

async function verifyUserSession({ fetchImpl, supabaseUrl, publishableKey, token }) {
  const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    return { user: null, error: "RoachClaw couldn't confirm your sign-in. Sign in again, then resend your message." }
  }

  const user = await response.json().catch(() => null)
  if (!user?.id) {
    return { user: null, error: "RoachClaw couldn't confirm your sign-in. Sign in again, then resend your message." }
  }

  return { user, error: '' }
}

function createDatabaseClient({ fetchImpl, supabaseUrl, apiKey, authToken }) {
  function restUrl(table, query = '') {
    const suffix = query ? `?${query}` : ''
    return `${supabaseUrl}/rest/v1/${table}${suffix}`
  }

  async function request(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
    const response = await fetchImpl(restUrl(table, query), {
      method,
      headers: {
        'content-type': 'application/json',
        apikey: apiKey,
        authorization: `Bearer ${authToken}`,
        prefer,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload?.message || payload?.hint || payload?.error || 'Database request did not finish cleanly.'
      throw new Error(message)
    }

    return payload
  }

  return { request }
}

async function sendRoachClawRelay({
  fetchImpl,
  bridgeUrl,
  bridgeToken,
  model,
  content,
  remoteSessionId,
  messages,
}) {
  const requestUrl = `${bridgeUrl}/api/companion/chat/send`
  const response = await fetchImpl(requestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-roachnet-companion-token': bridgeToken,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      sessionId: remoteSessionId || undefined,
      content,
      model,
      messages: Array.isArray(messages) ? messages.slice(-20) : [],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = sanitizeLabel(payload?.error || payload?.message || '') || 'RoachClaw could not get a clean reply from your device.'
    throw new PublicError(message)
  }

  const text = String(payload?.assistantMessage?.content || '').trim()
  if (!text) {
    throw new PublicError('RoachClaw returned an empty reply from the paired device.')
  }

  return {
    text,
    provider: 'RoachClaw local relay',
    model: String(payload?.session?.model || model || '').trim() || null,
    remoteSessionId: payload?.session?.id ? String(payload.session.id) : null,
    remoteSessionTitle: sanitizeLabel(payload?.session?.title || ''),
  }
}

function extractGeneratedReply(result) {
  const generated = Array.isArray(result) ? result[0]?.generated_text ?? result[0] : result

  if (Array.isArray(generated)) {
    const assistant = [...generated].reverse().find((entry) => entry?.role === 'assistant' && entry?.content)
    return String(assistant?.content || '').trim()
  }

  if (typeof generated === 'string') {
    return generated.trim()
  }

  return ''
}

export function getRoachBrainPipeline() {
  if (roachBrainPipelinePromise) {
    return roachBrainPipelinePromise
  }

  roachBrainPipelinePromise = (async () => {
    // The Node build runs ONNX natively (onnxruntime-node, Linux x64 only in
    // the deploy bundle; see scripts/build-functions-deploy.mjs) and caches the
    // model files in /tmp. The web build can't do either in Node: it has no
    // file cache and its WebGPU runtime has no InferenceSession there, so every
    // reply failed before this.
    const { env, pipeline } = await import('@huggingface/transformers')
    await mkdir(roachBrainCacheDir, { recursive: true })
    env.cacheDir = roachBrainCacheDir
    env.allowLocalModels = false
    env.allowRemoteModels = true

    let lastError = null
    for (const dtype of roachBrainModel.dtypes) {
      try {
        const generator = await pipeline('text-generation', roachBrainModel.id, {
          dtype,
          revision: roachBrainModel.revision,
        })
        return {
          generator,
          modelLabel: roachBrainModel.label,
        }
      } catch (error) {
        lastError = error
        console.warn(`RoachBrain Cloud could not load ${roachBrainModel.label} (${dtype}).`, error)
      }
    }

    throw lastError || new Error('RoachBrain Cloud could not load a usable model.')
  })().catch((error) => {
    roachBrainPipelinePromise = null
    throw error
  })

  return roachBrainPipelinePromise
}

async function generateRoachBrainReply({ history, prompt }) {
  const { generator, modelLabel } = await getRoachBrainPipeline()

  const conversation = [
    {
      role: 'system',
      content: defaultSystemPrompt,
    },
    ...history
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: sanitizeMessageContent(item.content),
      }))
      .filter((item) => item.content.length > 0)
      .slice(-10),
  ]

  const result = await generator(conversation, {
    max_new_tokens: 96,
    do_sample: false,
    repetition_penalty: 1.04,
  })

  const text = extractGeneratedReply(result)
  if (!text) {
    throw new Error('RoachBrain Cloud returned an empty reply.')
  }

  return {
    text,
    provider: 'RoachBrain Cloud',
    model: modelLabel,
    remoteSessionId: null,
    remoteSessionTitle: '',
  }
}

async function consumeRateLimit({ store, key, limit, windowMs, now }) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const entry = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' })
    if (!entry) {
      const result = await store.setJSON(key, { count: 1, resetAt: now + windowMs }, { onlyIfNew: true })
      if (result.modified) return { allowed: true, retryAfterSeconds: 0 }
      continue
    }

    const count = Number(entry.data?.count)
    const resetAt = Number(entry.data?.resetAt)
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(resetAt)) {
      throw new Error('Invalid chat rate-limit state.')
    }
    if (now < resetAt && count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
    }

    const nextState = now >= resetAt ? { count: 1, resetAt: now + windowMs } : { count: count + 1, resetAt }
    const result = await store.setJSON(key, nextState, { onlyIfMatch: entry.etag })
    if (result.modified) return { allowed: true, retryAfterSeconds: 0 }
  }

  throw new Error('Chat rate-limit contention did not settle.')
}

// Resolves to 'ready', 'failed' or 'waiting' without ever rejecting.
function settleWithin(promise, ms) {
  let timer
  return Promise.race([
    promise.then(
      () => 'ready',
      () => 'failed'
    ),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve('waiting'), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export function createChatHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  getRateLimitStore = () => getStore('roachclaw-chat-rate-limits'),
  generateReply = generateRoachBrainReply,
  prepareReply = getRoachBrainPipeline,
  modelWait = modelWaitMs,
  loadRuntime = () => import('@huggingface/transformers'),
  now = Date.now,
} = {}) {
  return async (request, context) => {
    const withEnvCors = (req, response) => withCors(req, response, env)

    if (!isAllowedRequestOrigin(request, env)) {
      return json({ ok: false, message: 'Origin not allowed.' }, 403)
    }

    // A cheap, signed-out check that the deploy carries the native runtime the
    // hosted model needs. It loads code only: no model download, no database.
    if (request.method === 'GET' && new URL(request.url).searchParams.get('health') === 'runtime') {
      try {
        await loadRuntime()
        return json({ ok: true, runtime: 'ready', model: roachBrainModel.label, revision: roachBrainModel.revision.slice(0, 12) })
      } catch (error) {
        console.error('RoachBrain Cloud runtime did not load.', error)
        return json({ ok: false, runtime: 'missing' }, 503)
      }
    }

    if (request.method === 'OPTIONS') {
      return withEnvCors(request, json({ ok: true }))
    }

    if (request.method !== 'POST') {
      return withEnvCors(request, json({ ok: false, message: 'Use POST for RoachClaw chat.' }, 405))
    }

    const supabaseUrl = env.ROACHNET_SUPABASE_URL || ''
    const publishableKey = env.ROACHNET_SUPABASE_ANON_KEY || ''
    const chatEnabled = env.ROACHNET_WEB_CHAT_ENABLED === '1'
    const model = env.ROACHNET_WEB_CHAT_MODEL || 'RoachClaw relay'
    const allowedBridgeOrigins = new Set(
      (env.ROACHNET_ALLOWED_BRIDGE_ORIGINS || '')
        .split(',')
        .map(normalizeBridgeUrl)
        .filter(Boolean)
    )

    if (!supabaseUrl || !publishableKey) {
      return withEnvCors(
        request,
        json({ ok: false, message: "RoachClaw on the web can't reach its account service. Try again later. RoachClaw in the Mac app isn't affected." }, 503)
      )
    }

    if (!chatEnabled || !model) {
      return withEnvCors(
        request,
        json(
          {
            ok: false,
            code: 'lane_not_armed',
            message: "RoachClaw on the web is switched off for now. RoachClaw in the Mac app isn't affected.",
          },
          503
        )
      )
    }

    const token = bearerToken(request)
    if (!token) {
      return withEnvCors(request, json({ ok: false, message: 'Sign in first.' }, 401))
    }

    const { user, error: sessionError } = await verifyUserSession({
      fetchImpl,
      supabaseUrl,
      publishableKey,
      token,
    })

    if (!user) {
      return withEnvCors(request, json({ ok: false, message: sessionError }, 401))
    }

    let payload
    try {
      const raw = await request.text()
      if (raw.length > maxBodyBytes) {
        return withEnvCors(request, json({ ok: false, message: 'That message is too long. Trim it and send it again.' }, 413))
      }
      payload = JSON.parse(raw)
    } catch {
      return withEnvCors(request, json({ ok: false, message: 'Send valid JSON.' }, 400))
    }

    const prompt = sanitizeMessageContent(payload?.message)
    const threadId = String(payload?.threadId || '').trim()
    const requestedBridgeUrl = normalizeBridgeUrl(payload?.bridgeUrl)
    const bridgeToken = String(payload?.bridgeToken || '').trim()
    const bridgeLabel = sanitizeLabel(payload?.bridgeLabel || '')

    if (!prompt) {
      return withEnvCors(request, json({ ok: false, message: 'Enter a message first.' }, 400))
    }

    if (threadId && !threadIdPattern.test(threadId)) {
      return withEnvCors(request, json({ ok: false, message: "RoachClaw doesn't recognize that conversation. Start a new chat and try again." }, 400))
    }

    if (requestedBridgeUrl && !isAllowedBridgeUrl(requestedBridgeUrl, allowedBridgeOrigins)) {
      return withEnvCors(request, json({ ok: false, message: 'That paired-device address is not allowed.' }, 400))
    }

    try {
      const store = getRateLimitStore()
      for (const rule of chatRateLimitRules) {
        const result = await consumeRateLimit({
          store,
          key: `${rule.scope}:${user.id}`,
          limit: rule.limit,
          windowMs: rule.windowMs,
          now: now(),
        })
        if (!result.allowed) {
          return withEnvCors(
            request,
            new Response(
              JSON.stringify({ ok: false, code: 'rate_limited', message: "That's a lot of messages. You've hit the web limit, so wait a while and try again. RoachClaw in the Mac app isn't affected." }),
              {
                status: 429,
                headers: {
                  'content-type': 'application/json; charset=utf-8',
                  'cache-control': 'no-store',
                  'retry-after': String(result.retryAfterSeconds),
                },
              }
            )
          )
        }
      }
    } catch (error) {
      console.error('RoachClaw chat rate limiter unavailable.', error)
      return withEnvCors(request, json({ ok: false, code: 'rate_limit_unavailable', message: "RoachClaw on the web is busy. Try again in a minute. RoachClaw in the Mac app isn't affected." }, 503))
    }

    // The hosted model answers unless the request carries a paired-Mac relay
    // token. Load it before anything is written, so a cold start or a failed
    // download leaves the conversation exactly as it was.
    if (!bridgeToken) {
      const loading = prepareReply()
      const state = await settleWithin(loading, modelWait)
      if (state === 'waiting') {
        context?.waitUntil?.(loading.catch(() => {}))
        return withEnvCors(
          request,
          json({ ok: false, code: 'warming', message: 'RoachClaw on the web is waking up. Send your message again in a few seconds. Nothing was lost.' }, 503)
        )
      }
      if (state === 'failed') {
        return withEnvCors(
          request,
          json({ ok: false, code: 'model_unavailable', message: "RoachClaw on the web can't load its model right now, so nothing was sent. Try again later. RoachClaw in the Mac app isn't affected." }, 503)
        )
      }
    }

    // Every row this function reads or writes belongs to the signed-in person,
    // so it uses their own token and Row Level Security applies. The service
    // role key is never used, even when it is set.
    const databaseClient = createDatabaseClient({
      fetchImpl,
      supabaseUrl,
      apiKey: publishableKey,
      authToken: token,
    })

    try {
      let thread = null

      if (threadId) {
        const query = new URLSearchParams({
          select: '*',
          id: `eq.${threadId}`,
          user_id: `eq.${user.id}`,
          limit: '1',
        })
        const rows = await databaseClient.request('chat_threads', { query: query.toString() })
        thread = rows?.[0] || null
        if (!thread) {
          return withEnvCors(request, json({ ok: false, message: "That conversation isn't in your account anymore. Start a new chat to keep going." }, 404))
        }
      } else {
        const inserted = await databaseClient.request('chat_threads', {
          method: 'POST',
          body: {
            user_id: user.id,
            title: summarizePrompt(prompt),
            summary: null,
            lane: 'roachclaw-web',
            source: 'roachnet.org/roachclaw',
            metadata: {
              createdBy: 'web',
            },
          },
        })
        thread = inserted?.[0] || null
      }

      const existingRelay = thread?.metadata?.relay && typeof thread.metadata.relay === 'object' ? thread.metadata.relay : {}
      const bridgeUrl = requestedBridgeUrl || normalizeBridgeUrl(existingRelay?.bridgeUrl)
      if (bridgeUrl && !isAllowedBridgeUrl(bridgeUrl, allowedBridgeOrigins)) {
        return withEnvCors(request, json({ ok: false, message: 'That paired-device address is no longer allowed.' }, 400))
      }
      const useBridgeRelay = Boolean(bridgeUrl && bridgeToken)

      const userInsert = await databaseClient.request('chat_messages', {
        method: 'POST',
        body: {
          thread_id: thread.id,
          user_id: user.id,
          role: 'user',
          content: prompt,
          metadata: {
            source: 'roachnet.org/roachclaw',
          },
        },
      })

      const messageQuery = new URLSearchParams({
        select: 'role,content,created_at',
        thread_id: `eq.${thread.id}`,
        user_id: `eq.${user.id}`,
        order: 'created_at.asc',
        limit: '24',
      })
      const history = await databaseClient.request('chat_messages', { query: messageQuery.toString() })

      const relayMessages = history
        .map((item) => ({
          role: item.role,
          content: sanitizeMessageContent(item.content),
        }))
        .filter((item) => item.content.length > 0)

      const reply = useBridgeRelay
        ? await sendRoachClawRelay({
            fetchImpl,
            bridgeUrl,
            bridgeToken,
            model,
            content: prompt,
            remoteSessionId: String(existingRelay?.remoteSessionId || '').trim(),
            messages: relayMessages,
          })
        : await generateReply({
            history: relayMessages,
            prompt,
          })

      const assistantInsert = await databaseClient.request('chat_messages', {
        method: 'POST',
        body: {
          thread_id: thread.id,
          user_id: user.id,
          role: 'assistant',
          content: reply.text,
          provider: reply.provider,
          model: reply.model,
          metadata: {
            source: 'roachnet.org/roachclaw',
            relay: useBridgeRelay
              ? {
                  kind: 'local-device',
                  bridgeUrl,
                  label: bridgeLabel || sanitizeLabel(existingRelay?.label || ''),
                }
              : {
                  kind: 'roachbrain-cloud',
                  label: 'RoachBrain Cloud',
                },
          },
        },
      })

      const relayMetadata = useBridgeRelay
        ? {
            kind: 'local-device',
            bridgeUrl,
            label: bridgeLabel || sanitizeLabel(existingRelay?.label || ''),
            remoteSessionId: reply.remoteSessionId || String(existingRelay?.remoteSessionId || '').trim() || null,
            lastUsedAt: new Date().toISOString(),
          }
        : {
            kind: 'roachbrain-cloud',
            label: 'RoachBrain Cloud',
            lastUsedAt: new Date().toISOString(),
          }

      const shouldRefreshTitle =
        !thread.summary ||
        thread.title === 'New chat' ||
        thread.title === summarizePrompt(prompt)

      const updatedThreadRows = await databaseClient.request('chat_threads', {
        method: 'PATCH',
        query: new URLSearchParams({
          select: '*',
          id: `eq.${thread.id}`,
          user_id: `eq.${user.id}`,
        }).toString(),
        body: shouldRefreshTitle
          ? {
              title: sanitizeLabel(reply.remoteSessionTitle) || summarizePrompt(prompt),
              summary: summarizeReply(reply.text),
              metadata: {
                ...(thread.metadata && typeof thread.metadata === 'object' ? thread.metadata : {}),
                relay: relayMetadata,
              },
            }
          : {
              summary: thread.summary || summarizeReply(reply.text),
              metadata: {
                ...(thread.metadata && typeof thread.metadata === 'object' ? thread.metadata : {}),
                relay: relayMetadata,
              },
            },
      })

      return withEnvCors(
        request,
        json({
          ok: true,
          thread: updatedThreadRows?.[0] || thread,
          userMessage: userInsert?.[0] || null,
          assistantMessage: assistantInsert?.[0] || null,
          provider: reply.provider,
          model: reply.model,
        })
      )
    } catch (error) {
      if (!(error instanceof PublicError)) console.error('RoachClaw chat request failed.', error)
      return withEnvCors(
        request,
        json(
          {
            ok: false,
            message: error instanceof PublicError ? error.message : "RoachClaw couldn't finish that reply. Your earlier messages are fine. Try again in a moment.",
          },
          500
        )
      )
    }
  }
}

export default async (request, context) => createChatHandler()(request, context)
