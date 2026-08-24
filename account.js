import {
  clearCachedAuthState,
  getSiteAuthState,
  refreshSiteSession,
  sessionLabel,
} from './site-account.js'

const browserDeviceStorageKey = 'RoachNetAccountBrowserDeviceID'
const turnstileScriptId = 'roachnet-turnstile-script'

const statusTitle = document.querySelector('#account-status-title')
const statusBody = document.querySelector('#account-status-body')
const statusBadge = document.querySelector('#account-status-badge')
const feedback = document.querySelector('#account-feedback')
const refreshButton = document.querySelector('#account-refresh')
const signOutButton = document.querySelector('#account-signout')
const submitButton = document.querySelector('#account-submit')
const form = document.querySelector('#account-form')
const formNote = document.querySelector('#account-form-note')
const emailInput = document.querySelector('#account-email')
const passwordInput = document.querySelector('#account-password')
const displayNameInput = document.querySelector('#account-display-name')
const displayNameField = document.querySelector('#account-name-field')
const startedAtInput = document.querySelector('#account-started-at')
const honeypotInput = document.querySelector('#account-company')
const tabs = [...document.querySelectorAll('[data-account-mode]')]
const snapshotTitle = document.querySelector('#account-snapshot-title')
const snapshotBody = document.querySelector('#account-snapshot-body')
const deviceCount = document.querySelector('#account-device-count')
const appCount = document.querySelector('#account-app-count')
const settingsState = document.querySelector('#account-settings-state')
const turnstileShell = document.querySelector('#account-turnstile-shell')
const turnstileMount = document.querySelector('#account-turnstile')
const turnstileNote = document.querySelector('#account-turnstile-note')

let accountMode = 'signin'
let authState = null
let authSubscription = null
let activeRequest = null
let turnstileWidgetId = null
let captchaToken = ''

function setFeedback(message, tone = 'muted') {
  if (!feedback) return
  feedback.textContent = message || ''
  feedback.dataset.tone = tone
}

function setSnapshot({
  title,
  body,
  devices = '—',
  apps = '—',
  settings = '—',
}) {
  if (snapshotTitle) snapshotTitle.textContent = title
  if (snapshotBody) snapshotBody.textContent = body
  if (deviceCount) deviceCount.textContent = devices
  if (appCount) appCount.textContent = apps
  if (settingsState) settingsState.textContent = settings
}

function getBrowserDeviceID() {
  const existing = window.localStorage.getItem(browserDeviceStorageKey)
  if (existing) return existing
  const next = `account-web-${window.crypto.randomUUID()}`
  window.localStorage.setItem(browserDeviceStorageKey, next)
  return next
}

function inferPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  if (userAgent.includes('iphone')) return 'ios-web'
  if (userAgent.includes('ipad')) return 'ipados-web'
  if (userAgent.includes('mac os')) return 'macos-web'
  if (userAgent.includes('windows')) return 'windows-web'
  if (userAgent.includes('linux')) return 'linux-web'
  return 'web'
}

function displayNameFor(profile, session) {
  if (profile?.display_name && profile.display_name.trim()) {
    return profile.display_name.trim()
  }

  const email = session?.user?.email || ''
  return email ? email.split('@')[0] : 'RoachNet account'
}

function setFormBusy(isBusy) {
  activeRequest = isBusy
  const disabled = Boolean(isBusy)

  for (const field of [emailInput, passwordInput, displayNameInput, submitButton, refreshButton, signOutButton]) {
    if (field) field.disabled = disabled
  }
}

function resetTurnstileIfPresent() {
  if (typeof window.turnstile?.reset === 'function' && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId)
  }
}

function setTurnstileState(message, tone = 'muted') {
  if (!turnstileNote) return
  turnstileNote.textContent = message
  turnstileNote.dataset.tone = tone
}

function setMode(nextMode) {
  accountMode = nextMode === 'signup' ? 'signup' : 'signin'

  tabs.forEach((tab) => {
    const isActive = tab.dataset.accountMode === accountMode
    tab.classList.toggle('is-active', isActive)
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
    tab.tabIndex = isActive ? 0 : -1
  })

  if (displayNameField) {
    displayNameField.hidden = accountMode !== 'signup'
  }

  if (passwordInput) {
    passwordInput.autocomplete = accountMode === 'signup' ? 'new-password' : 'current-password'
  }

  if (submitButton) {
    submitButton.textContent = accountMode === 'signup' ? 'Create account' : 'Sign in'
  }

  if (formNote) {
    formNote.textContent =
      accountMode === 'signup'
        ? 'Create the account that holds web chat, app picks, and device links.'
        : 'Sign in when you want the website tied to your RoachNet account.'
  }

  if (turnstileShell) {
    turnstileShell.hidden = accountMode !== 'signup' || !authState?.config?.turnstile?.enabled
  }

  setFeedback('')
}

function renderStatus() {
  if (!authState) return

  const enabled = authState.enabled === true
  const session = authState.session

  if (!enabled) {
    statusTitle.textContent = 'Auth is staged, not armed.'
    statusBody.textContent = authState.reason
    statusBadge.textContent = 'Disabled'
    statusBadge.dataset.state = 'disabled'
    signOutButton.hidden = true
    form?.setAttribute('aria-disabled', 'true')
    setFormBusy(true)
    setSnapshot({
      title: 'Auth is disabled on this deploy.',
      body: 'The account system is staged, but this deploy is missing live auth keys.',
    })
    setFeedback('This deploy does not have live account auth configured yet.')
    return
  }

  form?.removeAttribute('aria-disabled')
  setFormBusy(false)

  if (session?.user) {
    statusTitle.textContent = 'Signed in.'
    statusBody.textContent = `Website account is linked to ${sessionLabel(session)}.`
    statusBadge.textContent = 'Live'
    statusBadge.dataset.state = 'live'
    signOutButton.hidden = false
    setFeedback('Account session is live.', 'live')
    return
  }

  statusTitle.textContent = 'Ready for sign-in.'
  statusBody.textContent = 'Use your account for web chat, saved app picks, and device metadata.'
  statusBadge.textContent = 'Ready'
  statusBadge.dataset.state = 'ready'
  signOutButton.hidden = true
  setSnapshot({
    title: 'Sign in to load account state.',
    body: 'Linked devices, saved app picks, and settings metadata will show up here once you sign in.',
  })
}

async function syncSnapshot() {
  if (!authState?.client || !authState?.session?.user) {
    return
  }

  const client = authState.client
  const browserDeviceID = getBrowserDeviceID()
  const currentOrigin = window.location.origin

  const [touchResult, profileResult, settingsResult, devicesResult, appsResult] = await Promise.all([
    client.rpc('touch_device_link', {
      p_device_id: browserDeviceID,
      p_device_name: 'Accounts Web',
      p_platform: inferPlatform(),
      p_runtime_lane: 'account-web',
      p_metadata: {
        surface: 'accounts',
        origin: currentOrigin,
      },
    }),
    client
      .from('profiles')
      .select('display_name, email, plan, account_state, last_seen_at')
      .eq('id', authState.session.user.id)
      .maybeSingle(),
    client
      .from('user_settings')
      .select('updated_at, favorite_apps, settings')
      .eq('user_id', authState.session.user.id)
      .maybeSingle(),
    client.from('device_links').select('id', { count: 'exact', head: true }),
    client.from('saved_apps').select('id', { count: 'exact', head: true }),
  ])

  const errors = [
    touchResult.error,
    profileResult.error,
    settingsResult.error,
    devicesResult.error,
    appsResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    setFeedback(errors[0].message || 'Could not load the account snapshot.', 'error')
    setSnapshot({
      title: 'Account snapshot needs attention.',
      body: 'The account session is live, but this browser session could not finish loading its synced state.',
      settings: 'Error',
    })
    return
  }

  const profile = profileResult.data
  const settings = settingsResult.data
  const devices = devicesResult.count ?? 0
  const apps = appsResult.count ?? 0
  const settingsCount =
    (settings?.favorite_apps?.length || 0) + Object.keys(settings?.settings || {}).length

  setSnapshot({
    title: `${displayNameFor(profile, authState.session)} is linked.`,
    body:
      devices > 0
        ? 'RoachTail and RoachSync metadata can anchor themselves here without leaking local machine details.'
        : 'This is a fresh account. Pair devices or save installs to start building synced state.',
    devices: String(devices),
    apps: String(apps),
    settings: settingsCount > 0 ? 'Remembered' : 'Fresh',
  })
}

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }

    const existing = document.querySelector(`#${turnstileScriptId}`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = turnstileScriptId
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(window.turnstile), { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.append(script)
  })
}

async function ensureTurnstile() {
  const turnstileConfig = authState?.config?.turnstile
  if (!turnstileConfig?.enabled || !turnstileConfig?.siteKey || !turnstileMount || turnstileWidgetId !== null) {
    if (turnstileShell) {
      turnstileShell.hidden = accountMode !== 'signup' || !turnstileConfig?.enabled
    }
    return
  }

  setTurnstileState('Loading verification…')

  try {
    await loadTurnstileScript()
    turnstileWidgetId = window.turnstile.render(turnstileMount, {
      sitekey: turnstileConfig.siteKey,
      theme: 'dark',
      callback: (token) => {
        captchaToken = token
        setTurnstileState('Verification ready.', 'live')
      },
      'expired-callback': () => {
        captchaToken = ''
        setTurnstileState('Verification expired. Run it again.', 'error')
      },
      'error-callback': () => {
        captchaToken = ''
        setTurnstileState('Verification failed to load.', 'error')
      },
    })
    setTurnstileState('Finish the human check to create the account.')
  } catch {
    setTurnstileState('Verification could not load right now.', 'error')
  }
}

async function registerAccount({ email, password, displayName }) {
  const registerUrl =
    authState?.config?.auth?.registerUrl || 'https://roachnet.org/.netlify/functions/register-account'
  const response = await fetch(registerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      displayName,
      captchaToken,
      company: honeypotInput?.value || '',
      startedAt: startedAtInput?.value || '',
    }),
  })

  const result = await response.json().catch(() => ({
    ok: false,
    message: 'The account service returned unreadable data.',
  }))

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || 'Account creation failed.')
  }

  return result
}

async function loadAuthState() {
  authSubscription?.unsubscribe?.()
  authSubscription = null

  authState = await getSiteAuthState()
  renderStatus()

  if (authState?.client) {
    const { data } = authState.client.auth.onAuthStateChange((_event, session) => {
      authState = {
        ...authState,
        session,
      }
      renderStatus()
      void syncSnapshot()
    })
    authSubscription = data.subscription
  }

  await ensureTurnstile()
  await syncSnapshot()
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (activeRequest) return
    setMode(tab.dataset.accountMode)
  })
})

refreshButton?.addEventListener('click', async () => {
  setFeedback('Refreshing account state…')
  const session = await refreshSiteSession()
  if (authState) {
    authState = {
      ...authState,
      session,
    }
  }
  renderStatus()
  await syncSnapshot()
})

signOutButton?.addEventListener('click', async () => {
  if (!authState?.client) return
  setFormBusy(true)
  setFeedback('Signing out…')
  await authState.client.auth.signOut()
  clearCachedAuthState()
  authState = null
  await loadAuthState()
})

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!authState?.client) {
    setFeedback('Account auth is not armed on this deploy yet.', 'error')
    return
  }

  const email = emailInput?.value?.trim() || ''
  const password = passwordInput?.value || ''
  const displayName = displayNameInput?.value?.trim() || ''

  if (!email || !password) {
    setFeedback('Enter both email and password.', 'error')
    return
  }

  if (accountMode === 'signup' && authState?.config?.turnstile?.enabled && !captchaToken) {
    setFeedback('Finish the human check first.', 'error')
    return
  }

  setFormBusy(true)
  setFeedback(accountMode === 'signup' ? 'Creating account…' : 'Signing in…')

  try {
    if (accountMode === 'signup') {
      const registration = await registerAccount({ email, password, displayName })
      form.reset()
      startedAtInput.value = String(Date.now())
      captchaToken = ''
      resetTurnstileIfPresent()
      setMode('signin')
      setFeedback(
        registration.message || 'Check your email to confirm your account, then sign in.',
        'live'
      )
      return
    }

    const result = await authState.client.auth.signInWithPassword({ email, password })
    if (result.error) {
      throw result.error
    }

    authState = {
      ...authState,
      session: result.data?.session || authState.session,
    }

    renderStatus()
    await syncSnapshot()
    setFeedback('Signed in.', 'live')
  } catch (error) {
    setFeedback(error?.message || 'Account request failed.', 'error')
    captchaToken = ''
    resetTurnstileIfPresent()
  } finally {
    setFormBusy(false)
  }
})

startedAtInput.value = String(Date.now())
setMode(accountMode)
loadAuthState()
