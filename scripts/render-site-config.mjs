import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputPath = process.env.ROACHNET_SITE_CONFIG_OUTPUT || path.join(repoRoot, 'site-config.js')
const remotePublicConfigUrl =
  process.env.ROACHNET_PUBLIC_SITE_CONFIG_URL || 'https://accounts.roachnet.org/site-config.js'

const releaseVersion = process.env.ROACHNET_RELEASE_VERSION || '1.0.4'

function parseAssignedJson(source) {
  const normalized = String(source || '').trim()
  const prefix = 'window.__ROACHNET_SITE_CONFIG__ ='
  if (!normalized.startsWith(prefix)) {
    return null
  }

  const jsonText = normalized.slice(prefix.length).trim().replace(/;$/, '')
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

async function loadRemotePublicConfig() {
  try {
    const response = await fetch(remotePublicConfigUrl, {
      headers: { accept: 'application/javascript, text/javascript, text/plain;q=0.9, */*;q=0.1' },
    })
    if (!response.ok) {
      return null
    }

    return parseAssignedJson(await response.text())
  } catch {
    return null
  }
}

const remotePublicConfig = await loadRemotePublicConfig()
const publicAuthDefaults = remotePublicConfig?.auth || {}
const publicWebChatDefaults = remotePublicConfig?.webChat || {}
const publicTurnstileDefaults = remotePublicConfig?.turnstile || {}

const authEnabled =
  (process.env.ROACHNET_AUTH_ENABLED === '1' &&
    Boolean(process.env.ROACHNET_SUPABASE_URL) &&
    Boolean(process.env.ROACHNET_SUPABASE_ANON_KEY)) ||
  publicAuthDefaults.enabled === true
const webChatEnabled =
  process.env.ROACHNET_WEB_CHAT_ENABLED === '1' || publicWebChatDefaults.enabled === true

const config = {
  releaseVersion,
  auth: {
    enabled: authEnabled,
    provider: 'supabase',
    supabaseUrl: process.env.ROACHNET_SUPABASE_URL || publicAuthDefaults.supabaseUrl || '',
    supabaseAnonKey:
      process.env.ROACHNET_SUPABASE_ANON_KEY || publicAuthDefaults.supabaseAnonKey || '',
    redirectUrl: process.env.ROACHNET_AUTH_REDIRECT_URL || 'https://accounts.roachnet.org/',
    registerUrl:
      process.env.ROACHNET_ACCOUNT_REGISTER_URL ||
      'https://roachnet.org/.netlify/functions/register-account',
    remoteConfigUrl: process.env.ROACHNET_AUTH_REMOTE_CONFIG_URL || 'https://accounts.roachnet.org/site-config.js',
  },
  webChat: {
    enabled: webChatEnabled,
    mode:
      process.env.ROACHNET_WEB_CHAT_MODE ||
      publicWebChatDefaults.mode ||
      (webChatEnabled ? 'live' : 'planned'),
    accountRequired: process.env.ROACHNET_WEB_CHAT_ACCOUNT_REQUIRED !== '0',
    endpoint:
      process.env.ROACHNET_WEB_CHAT_ENDPOINT ||
      'https://roachnet.org/.netlify/functions/roachclaw-chat',
    providerLabel:
      process.env.ROACHNET_WEB_CHAT_PROVIDER_LABEL ||
      publicWebChatDefaults.providerLabel ||
      'RoachClaw local + RoachBrain Cloud',
    modelLabel:
      process.env.ROACHNET_WEB_CHAT_MODEL_LABEL ||
      publicWebChatDefaults.modelLabel ||
      'Local relay or cloud model',
  },
  turnstile: {
    enabled:
      Boolean(process.env.ROACHNET_TURNSTILE_SITE_KEY) || publicTurnstileDefaults.enabled === true,
    siteKey: process.env.ROACHNET_TURNSTILE_SITE_KEY || publicTurnstileDefaults.siteKey || '',
  },
}

const output = `window.__ROACHNET_SITE_CONFIG__ = ${JSON.stringify(config, null, 2)}\n`
await writeFile(outputPath, output, 'utf8')
