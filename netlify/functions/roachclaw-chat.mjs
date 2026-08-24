import { mkdir } from 'node:fs/promises'

const allowedOrigins = new Set([
  'https://roachnet.org',
  'https://accounts.roachnet.org',
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:3000',
])

function isAllowedRequestOrigin(request) {
  const origin = request.headers.get('origin') || ''
  return !origin || allowedOrigins.has(origin)
}

const defaultSystemPrompt =
  'You are RoachClaw on the RoachNet web lane. Answer clearly, keep user data isolated to the authenticated account lane, never claim access to a local machine you cannot see, and prefer practical help over filler.'
const roachBrainCacheDir = '/tmp/roachbrain-cloud-cache'
const roachBrainCandidates = [
  {
    id: 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA',
    label: 'SmolLM2 135M',
  },
  {
    id: 'onnx-community/gemma-3-270m-it-ONNX',
    label: 'Gemma 3 270M',
  },
]

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

function normalizeOrigin(request) {
  const origin = request.headers.get('origin') || ''
  if (allowedOrigins.has(origin)) {
    return origin
  }

  return 'https://roachnet.org'
}

function withCors(request, response) {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', normalizeOrigin(request))
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

async function verifyUserSession({ supabaseUrl, publishableKey, token }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    return { user: null, error: 'This account session is not valid anymore.' }
  }

  const user = await response.json().catch(() => null)
  if (!user?.id) {
    return { user: null, error: 'Could not resolve the signed-in user.' }
  }

  return { user, error: '' }
}

function createDatabaseClient({ supabaseUrl, apiKey, authToken }) {
  function restUrl(table, query = '') {
    const suffix = query ? `?${query}` : ''
    return `${supabaseUrl}/rest/v1/${table}${suffix}`
  }

  async function request(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
    const response = await fetch(restUrl(table, query), {
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
  bridgeUrl,
  bridgeToken,
  model,
  content,
  remoteSessionId,
  messages,
}) {
  const requestUrl = `${bridgeUrl}/api/companion/chat/send`
  const response = await fetch(requestUrl, {
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
    const message = payload?.error || payload?.message || 'RoachClaw could not get a clean reply from your device.'
    throw new Error(message)
  }

  const text = String(payload?.assistantMessage?.content || '').trim()
  if (!text) {
    throw new Error('RoachClaw returned an empty reply from the paired device.')
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

async function getRoachBrainPipeline() {
  if (roachBrainPipelinePromise) {
    return roachBrainPipelinePromise
  }

  roachBrainPipelinePromise = (async () => {
    // Force the web runtime build so Netlify does not bundle the heavyweight
    // native ONNX binaries for every platform into this function artifact.
    const { env, pipeline } = await import('../../node_modules/@huggingface/transformers/dist/transformers.web.js')
    await mkdir(roachBrainCacheDir, { recursive: true })
    env.cacheDir = roachBrainCacheDir
    env.allowLocalModels = false
    env.allowRemoteModels = true
    env.useFSCache = true

    let lastError = null
    for (const candidate of roachBrainCandidates) {
      for (const dtype of ['q4', 'q8']) {
        try {
          const generator = await pipeline('text-generation', candidate.id, {
            dtype,
          })
          return {
            generator,
            modelLabel: candidate.label,
          }
        } catch (error) {
          lastError = error
          console.warn(`RoachBrain Cloud model attempt failed for ${candidate.label} (${dtype}).`, error)
        }
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

export default async (request) => {
  if (!isAllowedRequestOrigin(request)) {
    return json({ ok: false, message: 'Origin not allowed.' }, 403)
  }

  if (request.method === 'OPTIONS') {
    return withCors(request, json({ ok: true }))
  }

  if (request.method !== 'POST') {
    return withCors(request, json({ ok: false, message: 'Use POST for RoachClaw chat.' }, 405))
  }

  const supabaseUrl = process.env.ROACHNET_SUPABASE_URL || ''
  const publishableKey = process.env.ROACHNET_SUPABASE_ANON_KEY || ''
  const serviceRoleKey = process.env.ROACHNET_SUPABASE_SERVICE_ROLE_KEY || ''
  const chatEnabled = process.env.ROACHNET_WEB_CHAT_ENABLED === '1'
  const model = process.env.ROACHNET_WEB_CHAT_MODEL || 'RoachClaw relay'
  const allowedBridgeOrigins = new Set(
    (process.env.ROACHNET_ALLOWED_BRIDGE_ORIGINS || '')
      .split(',')
      .map(normalizeBridgeUrl)
      .filter(Boolean)
  )

  if (!supabaseUrl || !publishableKey) {
    return withCors(
      request,
      json({ ok: false, message: 'The hosted lane is missing its account backend configuration.' }, 503)
    )
  }

  if (!chatEnabled || !model) {
    return withCors(
      request,
      json(
        {
          ok: false,
          code: 'lane_not_armed',
          message: 'RoachClaw web is not armed on this deploy yet.',
        },
        503
      )
    )
  }

  const token = bearerToken(request)
  if (!token) {
    return withCors(request, json({ ok: false, message: 'Sign in first.' }, 401))
  }

  const { user, error: sessionError } = await verifyUserSession({
    supabaseUrl,
    publishableKey,
    token,
  })

  if (!user) {
    return withCors(request, json({ ok: false, message: sessionError }, 401))
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return withCors(request, json({ ok: false, message: 'Send valid JSON.' }, 400))
  }

  const prompt = sanitizeMessageContent(payload?.message)
  const threadId = String(payload?.threadId || '').trim()
  const requestedBridgeUrl = normalizeBridgeUrl(payload?.bridgeUrl)
  const bridgeToken = String(payload?.bridgeToken || '').trim()
  const bridgeLabel = sanitizeLabel(payload?.bridgeLabel || '')

  if (!prompt) {
    return withCors(request, json({ ok: false, message: 'Enter a message first.' }, 400))
  }

  if (requestedBridgeUrl && !isAllowedBridgeUrl(requestedBridgeUrl, allowedBridgeOrigins)) {
    return withCors(request, json({ ok: false, message: 'That paired-device address is not allowed.' }, 400))
  }

  const databaseClient = createDatabaseClient({
    supabaseUrl,
    apiKey: serviceRoleKey || publishableKey,
    authToken: serviceRoleKey || token,
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
        return withCors(request, json({ ok: false, message: 'That chat is not yours anymore.' }, 404))
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
      return withCors(request, json({ ok: false, message: 'That paired-device address is no longer allowed.' }, 400))
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
          bridgeUrl,
          bridgeToken,
          model,
          content: prompt,
          remoteSessionId: String(existingRelay?.remoteSessionId || '').trim(),
          messages: relayMessages,
        })
      : await generateRoachBrainReply({
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

    return withCors(
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
    return withCors(
      request,
      json(
        {
          ok: false,
          message: error instanceof Error ? error.message : 'RoachClaw could not finish the request.',
        },
        500
      )
    )
  }
}
