const defaultSiteConfig = {
  releaseVersion: '1.0.7',
  auth: {
    enabled: false,
    provider: 'supabase',
    supabaseUrl: '',
    supabaseAnonKey: '',
    redirectUrl: 'https://accounts.roachnet.org/',
    registerUrl: 'https://roachnet.org/.netlify/functions/register-account',
    remoteConfigUrl: 'https://accounts.roachnet.org/site-config.js',
  },
  webChat: {
    enabled: false,
    mode: 'planned',
    accountRequired: true,
    endpoint: 'https://roachnet.org/.netlify/functions/roachclaw-chat',
    providerLabel: 'Your device or RoachBrain Cloud',
    modelLabel: 'Local relay or cloud model',
  },
  turnstile: {
    enabled: false,
    siteKey: '',
  },
}

let cachedAuthState = null
let pendingAuthState = null
let remoteConfigPromise = null

// supabase-js is self-hosted (pinned, MIT) so the account pages need no CDN:
// the CSP on accounts.roachnet.org allows scripts from 'self' only, and a
// privacy-first site should not ask a third party to serve its sign-in code.
const SUPABASE_JS_PATH = '/vendor/supabase-js/2.117.2/supabase.js'
let supabaseLoading = null
function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase)
  if (!supabaseLoading) {
    supabaseLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SUPABASE_JS_PATH
      script.async = true
      script.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('supabase-js loaded without createClient')))
      script.onerror = () => {
        supabaseLoading = null
        reject(new Error("The sign-in code didn't load. Check your connection and reload the page."))
      }
      document.head.append(script)
    })
  }
  return supabaseLoading
}

const authClientGlobalKey = '__ROACHNET_SUPABASE_AUTH_CLIENT__'

function mergeSiteConfig(...configs) {
  return configs.reduce(
    (merged, configured = {}) => ({
      ...merged,
      ...configured,
      auth: {
        ...merged.auth,
        ...(configured.auth || {}),
      },
      webChat: {
        ...merged.webChat,
        ...(configured.webChat || {}),
      },
      turnstile: {
        ...merged.turnstile,
        ...(configured.turnstile || {}),
      },
    }),
    structuredClone(defaultSiteConfig)
  )
}

function currentGlobalConfig() {
  return window.__ROACHNET_SITE_CONFIG__ || {}
}

function currentRemoteConfig() {
  return window.__ROACHNET_REMOTE_SITE_CONFIG__ || {}
}

async function loadRemoteSiteConfig() {
  if (window.__ROACHNET_REMOTE_SITE_CONFIG__) {
    return window.__ROACHNET_REMOTE_SITE_CONFIG__
  }

  if (window.location.hostname === 'accounts.roachnet.org') {
    return {}
  }

  if (remoteConfigPromise) {
    return remoteConfigPromise
  }

  const remoteConfigUrl =
    currentGlobalConfig()?.auth?.remoteConfigUrl || defaultSiteConfig.auth.remoteConfigUrl

  remoteConfigPromise = new Promise((resolve) => {
    const priorConfig = currentGlobalConfig()
    const script = document.createElement('script')
    script.src = `${remoteConfigUrl}?t=${Date.now()}`
    script.async = true

    script.onload = () => {
      window.__ROACHNET_REMOTE_SITE_CONFIG__ = window.__ROACHNET_SITE_CONFIG__ || {}
      window.__ROACHNET_SITE_CONFIG__ = priorConfig
      resolve(window.__ROACHNET_REMOTE_SITE_CONFIG__)
    }

    script.onerror = () => {
      window.__ROACHNET_SITE_CONFIG__ = priorConfig
      resolve({})
    }

    document.head.append(script)
  })

  return remoteConfigPromise
}

export function getSiteConfig() {
  return mergeSiteConfig(currentGlobalConfig(), currentRemoteConfig())
}

export async function getSiteAuthState() {
  if (cachedAuthState) {
    return cachedAuthState
  }

  if (pendingAuthState) {
    return pendingAuthState
  }

  pendingAuthState = resolveSiteAuthState()
  try {
    cachedAuthState = await pendingAuthState
    return cachedAuthState
  } finally {
    pendingAuthState = null
  }
}

async function resolveSiteAuthState() {
  let config = getSiteConfig()
  if ((!config.auth.enabled || !config.webChat.enabled) && window.location.hostname !== 'accounts.roachnet.org') {
    await loadRemoteSiteConfig()
    config = getSiteConfig()
  }

  const auth = config.auth || {}
  const enabled =
    auth.enabled === true &&
    auth.provider === 'supabase' &&
    typeof auth.supabaseUrl === 'string' &&
    auth.supabaseUrl.length > 0 &&
    typeof auth.supabaseAnonKey === 'string' &&
    auth.supabaseAnonKey.length > 0

  if (!enabled) {
    return {
      enabled: false,
      client: null,
      session: null,
      reason:
        "Sign-in is off on this copy of the site. RoachNet on your Mac doesn't need an account and works as usual.",
      config,
    }
  }

  const { createClient } = await loadSupabase()
  const globalClient = window[authClientGlobalKey]
  const client =
    globalClient?.supabaseUrl === auth.supabaseUrl &&
    globalClient?.supabaseAnonKey === auth.supabaseAnonKey
      ? globalClient.client
      : createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
          },
        })

  window[authClientGlobalKey] = {
    supabaseUrl: auth.supabaseUrl,
    supabaseAnonKey: auth.supabaseAnonKey,
    client,
  }

  const { data, error } = await client.auth.getSession()
  return {
    enabled: true,
    client,
    session: error ? null : data.session,
    reason: error ? error.message : '',
    config,
  }
}

export function sessionLabel(session) {
  const email = session?.user?.email
  return email && email.trim() ? email.trim() : 'Signed in'
}

export async function refreshSiteSession() {
  if (!cachedAuthState?.client) {
    return null
  }

  const { data } = await cachedAuthState.client.auth.getSession()
  cachedAuthState = {
    ...cachedAuthState,
    session: data.session,
  }
  return cachedAuthState.session
}

export function clearCachedAuthState() {
  cachedAuthState = null
  pendingAuthState = null
}
