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

function createHarness({ env = productionEnv, store = new MemoryRateLimitStore(), fetchImpl } = {}) {
  const calls = []
  const fetchStub = fetchImpl || (async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).includes('challenges.cloudflare.com')) {
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
  assert.equal(deployedResponse.status, 503)
  assert.equal((await body(deployedResponse)).code, 'captcha_unavailable')
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
