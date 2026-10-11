import {
  clearCachedAuthState,
  getSiteAuthState,
  refreshSiteSession,
  sessionLabel,
} from './site-account.js'

const browserDeviceStorageKey = 'RoachNetAccountBrowserDeviceID'
const turnstileScriptId = 'roachnet-turnstile-script'
const minimumPasswordLength = 10

const authCard = document.querySelector('#account-auth')
const dashboard = document.querySelector('#account-dashboard')
const statusTitle = document.querySelector('#account-status-title')
const statusBody = document.querySelector('#account-status-body')
const statusBadge = document.querySelector('#account-status-badge')
const feedback = document.querySelector('#account-feedback')
const refreshButton = document.querySelector('#account-refresh')
const signOutButton = document.querySelector('#account-signout')
const submitButton = document.querySelector('#account-submit')
const submitLabel = submitButton?.querySelector('.ac-submit__label') || submitButton
const form = document.querySelector('#account-form')
const formNote = document.querySelector('#account-form-note')
const emailInput = document.querySelector('#account-email')
const passwordInput = document.querySelector('#account-password')
const displayNameInput = document.querySelector('#account-display-name')
const displayNameField = document.querySelector('#account-name-field')
const startedAtInput = document.querySelector('#account-started-at')
const honeypotInput = document.querySelector('#account-company')
const tablist = document.querySelector('.ac-tabs')
const tabs = [...document.querySelectorAll('[data-account-mode]')]
const emailHint = document.querySelector('[data-hint="email"]')
const passwordHint = document.querySelector('[data-hint="password"]')
const snapshotTitle = document.querySelector('#account-snapshot-title')
const snapshotBody = document.querySelector('#account-snapshot-body')
const deviceCount = document.querySelector('#account-device-count')
const appCount = document.querySelector('#account-app-count')
const threadCount = document.querySelector('#account-thread-count')
const settingsState = document.querySelector('#account-settings-state')
const accountMini = document.querySelector('#account-mini')
const deviceList = document.querySelector('#account-device-list')
const appList = document.querySelector('#account-app-list')
const turnstileShell = document.querySelector('#account-turnstile-shell')
const turnstileMount = document.querySelector('#account-turnstile')
const turnstileNote = document.querySelector('#account-turnstile-note')

let accountMode = 'signin'
let authState = null
let authSubscription = null
let activeRequest = null
let turnstileWidgetId = null
let captchaToken = ''
let snapshotRun = null

function friendlyAuthError(error, fallback) {
  const message = String(error?.message || '')
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Could not reach the sign-in service. Check your connection and try again.'
  }
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account."
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. The link is in your inbox.'
  return message || fallback
}

function setAuthView(state) {
  if (authCard) authCard.dataset.authState = state
  if (dashboard) dashboard.dataset.authState = state
}

function setFeedback(message, tone = 'muted') {
  if (!feedback) return
  feedback.textContent = message || ''
  feedback.dataset.tone = tone
}

let toastElement = null
function toast(message) {
  if (!toastElement) {
    toastElement = document.createElement('div')
    toastElement.className = 'nx-toast'
    toastElement.setAttribute('role', 'status')
    toastElement.setAttribute('aria-live', 'polite')
    document.body.append(toastElement)
  }
  toastElement.textContent = message
  toastElement.classList.add('is-on')
  window.clearTimeout(toastElement.timer)
  toastElement.timer = window.setTimeout(() => toastElement.classList.remove('is-on'), 2600)
}

function formatRelativeTime(value) {
  if (!value) return ''
  const diff = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(diff)) return ''
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}

function platformLabel(platform) {
  const value = String(platform || '').toLowerCase()
  const base = value.replace(/-web$/, '')
  const names = { macos: 'Mac', ios: 'iPhone', ipados: 'iPad', windows: 'Windows', linux: 'Linux', web: 'Browser' }
  const name = names[base] || (base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Device')
  return value.endsWith('-web') && base !== 'web' ? `${name} browser` : name
}

function rowsEmpty(list, message) {
  if (!list) return
  const item = document.createElement('li')
  item.className = 'ac-rows__empty'
  item.textContent = message
  list.replaceChildren(item)
}

function rowsLoading(list) {
  if (!list) return
  list.replaceChildren(
    ...[0, 1].map(() => {
      const item = document.createElement('li')
      item.className = 'ac-rows__skeleton'
      item.setAttribute('aria-hidden', 'true')
      return item
    })
  )
}

function renderRow({ title, detail, meta, tag }) {
  const item = document.createElement('li')
  item.className = 'ac-row'
  const copy = document.createElement('div')
  copy.className = 'ac-row__copy'
  const strong = document.createElement('strong')
  strong.textContent = title
  copy.append(strong)
  if (detail) {
    const span = document.createElement('span')
    span.textContent = detail
    copy.append(span)
  }
  item.append(copy)
  const side = document.createElement('div')
  side.className = 'ac-row__side'
  if (tag) {
    const pill = document.createElement('span')
    pill.className = 'ac-row__tag'
    pill.textContent = tag
    side.append(pill)
  }
  if (meta) {
    const time = document.createElement('span')
    time.className = 'ac-row__meta'
    time.textContent = meta
    side.append(time)
  }
  item.append(side)
  return item
}

function setSnapshot({
  title,
  body,
  devices = '—',
  apps = '—',
  threads = '—',
  settings = '—',
}) {
  if (snapshotTitle) snapshotTitle.textContent = title
  if (snapshotBody) snapshotBody.textContent = body
  if (deviceCount) deviceCount.textContent = devices
  if (appCount) appCount.textContent = apps
  if (threadCount) threadCount.textContent = threads
  if (settingsState) settingsState.textContent = settings
}

function getBrowserDeviceID() {
  try {
    const existing = window.localStorage.getItem(browserDeviceStorageKey)
    if (existing) return existing
    const next = `account-web-${window.crypto.randomUUID()}`
    window.localStorage.setItem(browserDeviceStorageKey, next)
    return next
  } catch {
    return `account-web-${window.crypto.randomUUID()}`
  }
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
  return email ? email.split('@')[0] : 'Your account'
}

function setFormBusy(isBusy, label) {
  activeRequest = isBusy
  const disabled = Boolean(isBusy)

  for (const field of [emailInput, passwordInput, displayNameInput, submitButton, refreshButton, signOutButton, ...tabs]) {
    if (field) field.disabled = disabled
  }

  if (submitButton) {
    submitButton.classList.toggle('is-loading', disabled && Boolean(label))
    submitButton.setAttribute('aria-busy', disabled && label ? 'true' : 'false')
  }
  if (submitLabel) {
    submitLabel.textContent = label || (accountMode === 'signup' ? 'Create account' : 'Sign in')
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

function validateEmail({ quiet = false } = {}) {
  const value = String(emailInput?.value || '').trim()
  const valid = Boolean(value) && emailInput?.checkValidity() !== false
  if (!quiet || value) {
    emailInput?.closest('.ac-field')?.classList.toggle('is-invalid', !valid)
    emailInput?.setAttribute('aria-invalid', valid ? 'false' : 'true')
    if (emailHint) {
      emailHint.textContent = valid ? '' : value ? 'That email looks incomplete.' : 'Enter your email.'
      emailHint.dataset.tone = valid ? 'muted' : 'error'
    }
  }
  return valid
}

function validatePassword({ quiet = false } = {}) {
  const value = String(passwordInput?.value || '')
  const field = passwordInput?.closest('.ac-field')
  if (accountMode !== 'signup') {
    const valid = value.length > 0
    if (!quiet) {
      field?.classList.toggle('is-invalid', !valid)
      passwordInput?.setAttribute('aria-invalid', valid ? 'false' : 'true')
      if (passwordHint) {
        passwordHint.textContent = valid ? '' : 'Enter your password.'
        passwordHint.dataset.tone = 'error'
      }
    } else {
      field?.classList.remove('is-invalid', 'is-valid')
      if (passwordHint) passwordHint.textContent = ''
    }
    return valid
  }

  const remaining = minimumPasswordLength - value.length
  const valid = remaining <= 0
  field?.classList.toggle('is-valid', valid)
  field?.classList.toggle('is-invalid', !valid && !quiet)
  passwordInput?.setAttribute('aria-invalid', !valid && !quiet ? 'true' : 'false')
  if (passwordHint) {
    passwordHint.textContent = valid
      ? 'Long enough.'
      : value.length
        ? `At least ${minimumPasswordLength} characters. ${remaining} to go.`
        : `At least ${minimumPasswordLength} characters.`
    passwordHint.dataset.tone = valid ? 'live' : quiet ? 'muted' : 'error'
  }
  return valid
}

function setMode(nextMode, { focus = false } = {}) {
  accountMode = nextMode === 'signup' ? 'signup' : 'signin'

  if (tablist) tablist.dataset.mode = accountMode
  tabs.forEach((tab) => {
    const isActive = tab.dataset.accountMode === accountMode
    tab.classList.toggle('is-active', isActive)
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
    tab.tabIndex = isActive ? 0 : -1
    if (isActive && focus) tab.focus()
  })
  form?.setAttribute('aria-labelledby', accountMode === 'signup' ? 'account-tab-signup' : 'account-tab-signin')

  if (displayNameField) {
    displayNameField.hidden = accountMode !== 'signup'
  }

  if (passwordInput) {
    passwordInput.autocomplete = accountMode === 'signup' ? 'new-password' : 'current-password'
    passwordInput.placeholder = accountMode === 'signup' ? `${minimumPasswordLength} characters or more` : 'Your password'
  }

  if (submitLabel && !activeRequest) {
    submitLabel.textContent = accountMode === 'signup' ? 'Create account' : 'Sign in'
  }

  if (formNote) {
    formNote.textContent =
      accountMode === 'signup'
        ? 'You get a confirmation link before the account works. Use an inbox you can open.'
        : 'Signing in only links this browser to your account. The vault stays out of it.'
  }

  if (turnstileShell) {
    turnstileShell.hidden = accountMode !== 'signup' || !authState?.config?.turnstile?.enabled
  }

  emailInput?.closest('.ac-field')?.classList.remove('is-invalid')
  if (emailHint) emailHint.textContent = ''
  validatePassword({ quiet: true })
  setFeedback('')
}

function renderStatus() {
  if (!authState) return

  const enabled = authState.enabled === true
  const session = authState.session

  if (!enabled) {
    setAuthView('disabled')
    statusTitle.textContent = "Sign-in isn't available here."
    statusBody.textContent = authState.reason
    statusBadge.textContent = 'Off'
    statusBadge.dataset.state = 'disabled'
    signOutButton.hidden = true
    form?.setAttribute('aria-disabled', 'true')
    setFormBusy(true)
    setSnapshot({
      title: 'Nothing to show here.',
      body: "There's no account to read until sign-in is available.",
    })
    rowsEmpty(deviceList, 'Sign-in is off here.')
    rowsEmpty(appList, 'Sign-in is off here.')
    setFeedback('Sign-in is not switched on for this site yet.', 'error')
    return
  }

  form?.removeAttribute('aria-disabled')
  setFormBusy(false)

  if (session?.user) {
    setAuthView('signed-in')
    statusTitle.textContent = 'Signed in.'
    statusBody.textContent = `This browser is linked to ${sessionLabel(session)}.`
    statusBadge.textContent = 'Live'
    statusBadge.dataset.state = 'live'
    signOutButton.hidden = false
    return
  }

  setAuthView('signed-out')
  statusTitle.textContent = 'Not signed in.'
  statusBody.textContent = 'Sign in to see your devices and RoachClaw threads, or make an account in a minute.'
  statusBadge.textContent = 'Ready'
  statusBadge.dataset.state = 'ready'
  signOutButton.hidden = true
  setSnapshot({
    title: "Sign in to see what's here.",
    body: 'Your devices and RoachClaw threads show up here once you sign in.',
  })
  rowsEmpty(deviceList, 'Nothing to show until you sign in.')
  rowsEmpty(appList, 'Nothing to show until you sign in.')
}

async function syncSnapshot() {
  if (!authState?.client || !authState?.session?.user) {
    return
  }
  if (snapshotRun) return snapshotRun
  snapshotRun = loadSnapshot().finally(() => {
    snapshotRun = null
  })
  return snapshotRun
}

async function loadSnapshot() {
  const client = authState.client
  const browserDeviceID = getBrowserDeviceID()
  const currentOrigin = window.location.origin
  const userId = authState.session.user.id

  dashboard?.classList.add('is-syncing')
  rowsLoading(deviceList)
  rowsLoading(appList)

  const [touchResult, profileResult, settingsResult, devicesResult, appsResult, threadsResult] = await Promise.all([
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
      .eq('id', userId)
      .maybeSingle(),
    client
      .from('user_settings')
      .select('updated_at, favorite_apps, settings')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('device_links')
      .select('id, device_id, device_name, platform, runtime_lane, roachtail_status, last_seen_at', { count: 'exact' })
      .order('last_seen_at', { ascending: false })
      .limit(8),
    client
      .from('saved_apps')
      .select('id, app_id, title, category, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(8),
    // The thread count is a nice-to-have; a failure here never blocks the snapshot.
    Promise.resolve(client.from('chat_threads').select('id', { count: 'exact', head: true })).catch((error) => ({ error })),
  ])

  dashboard?.classList.remove('is-syncing')

  const errors = [
    touchResult.error,
    profileResult.error,
    settingsResult.error,
    devicesResult.error,
    appsResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    setFeedback(errors[0].message || 'Could not load your account details.', 'error')
    setSnapshot({
      title: 'Your account needs a second try.',
      body: 'You are signed in, but this browser could not load your account details. Refresh to try again.',
      settings: 'Error',
    })
    if (accountMini) accountMini.textContent = 'Your account details did not load. Try Refresh.'
    rowsEmpty(deviceList, 'Could not load devices.')
    rowsEmpty(appList, 'Could not load saved apps.')
    return
  }

  const profile = profileResult.data
  const settings = settingsResult.data
  const deviceRows = Array.isArray(devicesResult.data) ? devicesResult.data : []
  const appRows = Array.isArray(appsResult.data) ? appsResult.data : []
  const devices = devicesResult.count ?? deviceRows.length
  const apps = appsResult.count ?? appRows.length
  const threads = threadsResult?.error ? '—' : String(threadsResult?.count ?? 0)
  const settingsCount =
    (settings?.favorite_apps?.length || 0) + Object.keys(settings?.settings || {}).length

  setSnapshot({
    title: `Hello, ${displayNameFor(profile, authState.session)}.`,
    body:
      devices > 1
        ? 'Here is what your account holds right now. Nothing below came from your vault.'
        : 'A fresh account. Sign in from another device or save an app and it shows up here.',
    devices: String(devices),
    apps: String(apps),
    threads,
    settings: settingsCount > 0 ? 'Saved' : 'Default',
  })

  if (accountMini) {
    const plural = (count, word) => `${count} ${word}${String(count) === '1' ? '' : 's'}`
    accountMini.textContent = `${plural(devices, 'device')} · ${plural(apps, 'saved app')}${threads === '—' ? '' : ` · ${plural(threads, 'RoachClaw thread')}`}. `
    const link = document.createElement('a')
    link.className = 'nx-link nx-link--arrow'
    link.href = '#account-dashboard'
    link.textContent = 'See the details'
    accountMini.append(link)
  }

  if (deviceList) {
    if (!deviceRows.length) {
      rowsEmpty(deviceList, 'No devices yet.')
    } else {
      deviceList.replaceChildren(
        ...deviceRows.map((device) =>
          renderRow({
            title: device.device_name || 'Unnamed device',
            detail: platformLabel(device.platform),
            tag: device.device_id === browserDeviceID ? 'This browser' : device.roachtail_status === 'paired' ? 'Paired' : '',
            meta: formatRelativeTime(device.last_seen_at),
          })
        )
      )
    }
  }

  if (appList) {
    if (!appRows.length) {
      rowsEmpty(appList, "Nothing here yet. The store can't save picks today, so this list stays empty.")
    } else {
      appList.replaceChildren(
        ...appRows.map((app) =>
          renderRow({
            title: app.title || app.app_id,
            detail: app.category || '',
            meta: formatRelativeTime(app.updated_at),
          })
        )
      )
    }
  }
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
  // setMode() can run before the auth state arrives, so the shell's visibility is
  // settled again here; otherwise the widget renders inside a hidden shell and
  // nobody can finish the check.
  if (turnstileShell) {
    turnstileShell.hidden = accountMode !== 'signup' || !turnstileConfig?.enabled
  }
  if (!turnstileConfig?.enabled || !turnstileConfig?.siteKey || !turnstileMount || turnstileWidgetId !== null) {
    return
  }

  setTurnstileState('Loading the human check…')

  try {
    await loadTurnstileScript()
    turnstileWidgetId = window.turnstile.render(turnstileMount, {
      sitekey: turnstileConfig.siteKey,
      theme: 'dark',
      callback: (token) => {
        captchaToken = token
        setTurnstileState('Human check done.', 'live')
      },
      'expired-callback': () => {
        captchaToken = ''
        setTurnstileState('The human check expired. Run it again.', 'error')
      },
      'error-callback': () => {
        captchaToken = ''
        setTurnstileState("The human check didn't load. Reload the page to try again. Signing in doesn't need it.", 'error')
      },
    })
    setTurnstileState('Finish the human check to create the account.')
  } catch {
    setTurnstileState("The human check couldn't load. Reload the page to try again. Signing in doesn't need it.", 'error')
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
    message: 'The account service sent back something unreadable. Try again in a minute.',
  }))

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Sign-up didn't go through. Try again in a minute.")
  }

  return result
}

async function loadAuthState() {
  authSubscription?.unsubscribe?.()
  authSubscription = null

  try {
    authState = await getSiteAuthState()
  } catch (error) {
    authState = { enabled: false, client: null, session: null, reason: error?.message || 'The sign-in library did not load.' }
  }
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
    authSubscription = data?.subscription || null
  }

  await ensureTurnstile()
  await syncSnapshot()
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (activeRequest) return
    setMode(tab.dataset.accountMode)
  })
  tab.addEventListener('keydown', (event) => {
    if (activeRequest) return
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 'signin' : event.key === 'End' ? 'signup' : accountMode === 'signin' ? 'signup' : 'signin'
      setMode(next, { focus: true })
    }
  })
})

emailInput?.addEventListener('blur', () => validateEmail({ quiet: true }))
emailInput?.addEventListener('input', () => {
  if (emailInput.closest('.ac-field')?.classList.contains('is-invalid')) validateEmail({ quiet: true })
})
passwordInput?.addEventListener('input', () => validatePassword({ quiet: true }))

refreshButton?.addEventListener('click', async () => {
  setFeedback('')
  refreshButton.classList.add('is-loading')
  const session = await refreshSiteSession()
  if (authState) {
    authState = {
      ...authState,
      session,
    }
  }
  renderStatus()
  await syncSnapshot()
  refreshButton.classList.remove('is-loading')
  if (session?.user) toast('Account refreshed')
})

signOutButton?.addEventListener('click', async () => {
  if (!authState?.client) return
  setFormBusy(true)
  await authState.client.auth.signOut()
  clearCachedAuthState()
  authState = null
  await loadAuthState()
  toast('Signed out')
})

form?.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!authState?.client) {
    setFeedback('Sign-in is not switched on for this site yet.', 'error')
    return
  }

  const email = emailInput?.value?.trim() || ''
  const password = passwordInput?.value || ''
  const displayName = displayNameInput?.value?.trim() || ''

  const emailOK = validateEmail()
  const passwordOK = validatePassword()
  if (!email || !password || !emailOK || !passwordOK) {
    setFeedback(
      accountMode === 'signup' && password && !passwordOK
        ? `Use a password with at least ${minimumPasswordLength} characters.`
        : 'Enter both email and password.',
      'error'
    )
    ;(!emailOK ? emailInput : passwordInput)?.focus()
    return
  }

  if (accountMode === 'signup' && authState?.config?.turnstile?.enabled && !captchaToken) {
    setFeedback('Finish the human check first.', 'error')
    return
  }

  setFormBusy(true, accountMode === 'signup' ? 'Creating account…' : 'Signing in…')
  setFeedback('')

  try {
    if (accountMode === 'signup') {
      const registration = await registerAccount({ email, password, displayName })
      form.reset()
      startedAtInput.value = String(Date.now())
      captchaToken = ''
      resetTurnstileIfPresent()
      setMode('signin')
      if (emailInput) emailInput.value = email
      setFeedback(
        registration.message || 'Check your email to confirm your account, then sign in.',
        'confirm'
      )
      toast('Check your inbox')
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

    form.reset()
    renderStatus()
    toast(`Signed in as ${sessionLabel(authState.session)}`)
    await syncSnapshot()
  } catch (error) {
    setFeedback(friendlyAuthError(error, 'That did not go through. Try again.'), 'error')
    captchaToken = ''
    resetTurnstileIfPresent()
  } finally {
    setFormBusy(false)
  }
})

startedAtInput.value = String(Date.now())
const requestedMode = new URLSearchParams(window.location.search).get('mode')
setMode(requestedMode === 'signup' || window.location.hash === '#create' ? 'signup' : accountMode)
loadAuthState()
