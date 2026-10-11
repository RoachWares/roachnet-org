import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createChatHandler } from '../netlify/functions/roachclaw-chat.mjs'

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
    const canWrite = options.onlyIfNew ? !existing : options.onlyIfMatch ? existing?.etag === options.onlyIfMatch : true
    if (!canWrite) return { modified: false }
    const etag = `etag-${++this.version}`
    this.entries.set(key, { data: structuredClone(data), etag, metadata: {} })
    return { modified: true, etag }
  }
}

const armedEnv = {
  ROACHNET_SUPABASE_URL: 'https://project.supabase.co',
  ROACHNET_SUPABASE_ANON_KEY: 'public-anon-key',
  ROACHNET_WEB_CHAT_ENABLED: '1',
}

const threadId = '6f1c2a4e-3b5d-4c7e-9f10-2a3b4c5d6e7f'

function chatRequest({ origin = 'https://roachnet.org', token = 'user-token', body = { message: 'hello' } } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  if (token) headers.authorization = `Bearer ${token}`
  return new Request('https://roachnet.org/.netlify/functions/roachclaw-chat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function createHarness({ env = armedEnv, store = new MemoryRateLimitStore(), database, prepareReply = async () => ({}), modelWait, loadRuntime = async () => ({}) } = {}) {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const href = String(url)
    calls.push({ url: href, method: options.method || 'GET' })
    if (href.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1', email: 'person@example.com' })
    if (database) return database(href, options)
    if (href.includes('/rest/v1/chat_threads') && options.method === 'POST') return Response.json([{ id: threadId, title: 'hello', metadata: {} }])
    if (href.includes('/rest/v1/chat_threads') && options.method === 'PATCH') return Response.json([{ id: threadId, title: 'hello', metadata: {} }])
    if (href.includes('/rest/v1/chat_messages') && options.method === 'POST') return Response.json([{ id: `m-${calls.length}` }])
    if (href.includes('/rest/v1/chat_messages')) return Response.json([{ role: 'user', content: 'hello' }])
    return new Response('not found', { status: 404 })
  }
  const handler = createChatHandler({
    env,
    fetchImpl,
    getRateLimitStore: () => store,
    generateReply: async () => ({ text: 'Hi there.', provider: 'RoachBrain Cloud', model: 'test', remoteSessionId: null, remoteSessionTitle: '' }),
    prepareReply,
    loadRuntime,
    ...(modelWait === undefined ? {} : { modelWait }),
    now: () => Date.parse('2026-10-11T12:00:00.000Z'),
  })
  return { calls, handler, store }
}

const restCalls = (calls) => calls.filter(({ url }) => url.includes('/rest/v1/'))

test('chat answers a signed-in message end to end', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(chatRequest())
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'RoachBrain Cloud')
  assert.equal(restCalls(calls).length, 5)
})

test('a deployed chat function does not answer localhost origins', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(chatRequest({ origin: 'http://localhost:8888' }))
  assert.equal(response.status, 403)
  assert.equal(calls.length, 0)
})

test('chat needs a bearer token', async () => {
  const { calls, handler } = createHarness()
  const response = await handler(chatRequest({ token: '' }))
  assert.equal(response.status, 401)
  assert.equal(calls.length, 0)
})

test('chat refuses malformed thread ids and oversized bodies before touching the database', async () => {
  const { calls, handler } = createHarness()
  const badThread = await handler(chatRequest({ body: { message: 'hello', threadId: 'eq.x&user_id=neq.0' } }))
  assert.equal(badThread.status, 400)
  const huge = await handler(chatRequest({ body: { message: 'x'.repeat(70 * 1024) } }))
  assert.equal(huge.status, 413)
  assert.equal(restCalls(calls).length, 0)
})

test('each account gets a message budget', async () => {
  const { calls, handler } = createHarness()
  for (let index = 0; index < 20; index += 1) {
    assert.equal((await handler(chatRequest())).status, 200)
  }
  const before = restCalls(calls).length
  const blocked = await handler(chatRequest())
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
  assert.equal((await blocked.json()).code, 'rate_limited')
  assert.equal(restCalls(calls).length, before, 'a blocked message writes nothing')
})

test('chat fails closed when the limiter is unavailable', async () => {
  const { calls, handler } = createHarness({
    store: {
      async getWithMetadata() {
        throw new Error('blobs offline')
      },
    },
  })
  const response = await handler(chatRequest())
  assert.equal(response.status, 503)
  assert.equal(restCalls(calls).length, 0)
})

test('database error details stay on the server', async () => {
  const { handler } = createHarness({
    database: async () => Response.json({ message: 'column chat_threads.secret_column does not exist' }, { status: 400 }),
  })
  const response = await handler(chatRequest())
  assert.equal(response.status, 500)
  const result = await response.json()
  assert.equal(result.message, "RoachClaw couldn't finish that reply. Your earlier messages are fine. Try again in a moment.")
  assert.doesNotMatch(JSON.stringify(result), /secret_column/)
})

test('a cold model answers "waking up" and writes nothing', async () => {
  let release
  const loading = new Promise((resolve) => {
    release = resolve
  })
  const kept = []
  const { calls, handler } = createHarness({ prepareReply: () => loading, modelWait: 20 })
  const response = await handler(chatRequest(), { waitUntil: (promise) => kept.push(promise) })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'warming')
  assert.equal(restCalls(calls).length, 0, 'nothing is written while the model loads')
  assert.equal(kept.length, 1, 'the load keeps going after the reply')
  release({})
})

test('a model that cannot load says so and writes nothing', async () => {
  const { calls, handler } = createHarness({ prepareReply: () => Promise.reject(new Error('download failed')) })
  const response = await handler(chatRequest())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'model_unavailable')
  assert.equal(restCalls(calls).length, 0)
})

test('the runtime health check needs no sign-in and touches no database', async () => {
  const { calls, handler } = createHarness()
  const ok = await handler(new Request('https://roachnet.org/.netlify/functions/roachclaw-chat?health=runtime'))
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).runtime, 'ready')
  const broken = createHarness({ loadRuntime: async () => { throw new Error('no binding') } })
  const missing = await broken.handler(new Request('https://roachnet.org/.netlify/functions/roachclaw-chat?health=runtime'))
  assert.equal(missing.status, 503)
  assert.equal(calls.length + broken.calls.length, 0)
})
