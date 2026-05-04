const defaultSiteConfig = {
  releaseVersion: '1.0.4',
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
let remoteConfigPromise = null

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
    cachedAuthState = {
      enabled: false,
      client: null,
      session: null,
      reason:
        'Site accounts are not armed on this deploy yet. RoachTail, RoachSync, and the native runtime still stay on your own devices until this is live.',
      config,
    }
    return cachedAuthState
  }

  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
  const client = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  const { data, error } = await client.auth.getSession()
  cachedAuthState = {
    enabled: true,
    client,
    session: error ? null : data.session,
    reason: error ? error.message : '',
    config,
  }
  return cachedAuthState
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
}
