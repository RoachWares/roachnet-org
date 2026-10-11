const owner = 'RoachWares'
const repo = 'RoachNet'
const releaseVersion = window.__ROACHNET_SITE_CONFIG__?.releaseVersion || '1.0.6'
const latestReleaseApi = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
const latestReleasePage = `https://github.com/${owner}/${repo}/releases/latest`
const latestDownloadBase = `https://github.com/${owner}/${repo}/releases/latest/download`
const hostedDownloads = {
  mac: {
    url: `${latestDownloadBase}/RoachNet-Setup-macOS.dmg`,
    name: 'RoachNet-Setup-macOS.dmg',
    version: releaseVersion,
  },
}

const primaryDownloadButton = document.querySelector('#primary-download')
const downloadsPrimaryButton = document.querySelector('#downloads-primary')
const downloadMeta = document.querySelector('#download-meta')
const platformButtons = [...document.querySelectorAll('[data-platform]')]
const homebrewInstallButtons = [...document.querySelectorAll('[data-homebrew-install]')]
const homebrewCopyButtons = [...document.querySelectorAll('[data-homebrew-copy]')]
const homebrewNote = document.querySelector('#homebrew-note')
const commandLaunchButton = document.querySelector('#command-launch')
const commandPalette = document.querySelector('#command-palette')
const commandScrim = document.querySelector('#command-scrim')
const commandInput = document.querySelector('#command-input')
const commandItems = [...document.querySelectorAll('.command-item')]
const landingDownloadButton = document.querySelector('[data-landing-download-button]')
const landingDownloadStatus = document.querySelector('[data-landing-download-status]')
const landingShortcutKeys = [...document.querySelectorAll('[data-shortcut-key]')]
const landingNoiseSection = document.querySelector('[data-landing-noise]')
const landingNoiseScenes = [...document.querySelectorAll('[data-landing-noise-scene]')]
const landingNoiseTitle = document.querySelector('[data-landing-noise-title]')
const landingNoiseCopy = document.querySelector('[data-landing-noise-copy]')
const landingNoiseProgress = document.querySelector('[data-landing-noise-progress]')
const landingCanvas = document.querySelector('[data-landing-canvas]')
const heroTime = document.querySelector('[data-hero-time]')
const heroConnectivity = document.querySelector('[data-hero-connectivity]')
const heroStorage = document.querySelector('[data-hero-storage]')
const siteHeader = document.querySelector('.site-header')

const platformPresets = {
  mac: {
    label: 'macOS',
    patterns: [/^RoachNet-Setup-macOS\.dmg$/i, /RoachNet-Setup-.*-mac-.*\.dmg$/i, /RoachNet-Setup-.*-mac-.*\.zip$/i],
  },
}

let latestRelease = null
let activePlatform = detectPlatform()
let selectedCommandIndex = -1
let timeTicker = null
let landingRedirectTimer = null
let landingNoiseActiveIndex = 0
let landingNoiseTargetProgress = 0
let landingNoiseVisualProgress = 0
let landingNoiseFrame = 0

const homebrewCommand =
  'brew update && brew tap --force RoachWares/roachnet && brew install --cask roachnet'
const homebrewHelperUrl = '/downloads/RoachNet-Homebrew.command.zip'
const homePageUrl = 'https://roachnet.org/home/'

function setLandingShortcutStatus(text) {
  if (!landingDownloadStatus) {
    return
  }

  landingDownloadStatus.textContent = text
}

function setLandingShortcutKeys(activeKeys = []) {
  const activeSet = new Set(activeKeys)
  landingShortcutKeys.forEach((key) => {
    key.dataset.active = activeSet.has(key.dataset.shortcutKey) ? 'true' : 'false'
  })
}

function getDownloadUrlForPlatform(platformKey) {
  const asset = findAssetForPlatform(platformKey)
  if (isGitHubDownload(asset?.browser_download_url)) {
    return asset.browser_download_url
  }

  if (hostedDownloads[platformKey]?.url) {
    return hostedDownloads[platformKey].url
  }

  return latestReleasePage
}

// Release assets come from the GitHub API; only github.com download links are followed.
function isGitHubDownload(url) {
  try {
    const parsed = new URL(String(url || ''))
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
  } catch {
    return false
  }
}

// The DMG is served as an attachment, so navigating to it starts the download and
// leaves the page where it is. (A hidden iframe can't do this: the CSP's frame-src
// only admits the Turnstile widget.)
function startDownload(url) {
  if (!url) {
    return
  }

  if (url === latestReleasePage) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(url)
}

// The landing hands the download to Home: navigating to Home first and starting the
// download there means no second navigation can cancel it mid-redirect.
const homeDownloadParam = 'download'

function startHandedOffDownload() {
  if (!/^\/home\/?$/.test(window.location.pathname)) {
    return
  }
  const params = new URLSearchParams(window.location.search)
  if (params.get(homeDownloadParam) !== 'mac') {
    return
  }
  params.delete(homeDownloadParam)
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  startDownload(getDownloadUrlForPlatform('mac'))

  const toast = document.createElement('div')
  toast.className = 'nx-toast'
  toast.setAttribute('role', 'status')
  toast.textContent = 'RoachNet Setup is downloading. Open the DMG when it lands.'
  document.body.appendChild(toast)
  window.requestAnimationFrame(() => toast.classList.add('is-on'))
  window.setTimeout(() => toast.classList.remove('is-on'), 4200)
  window.setTimeout(() => toast.remove(), 4800)
}

function triggerLandingDownloadAndRedirect() {
  setLandingShortcutKeys(['shift', 'meta', 'r'])
  setLandingShortcutStatus('Opening Home. Your download starts there.')

  if (landingRedirectTimer) {
    window.clearTimeout(landingRedirectTimer)
  }

  landingRedirectTimer = window.setTimeout(() => {
    window.location.href = `${homePageUrl}?${homeDownloadParam}=mac`
  }, 900)
}

function applyLandingNoiseState(progress) {
  if (!landingNoiseSection || !landingNoiseScenes.length) {
    return
  }

  const sceneSpan = Math.max(1, landingNoiseScenes.length - 1)
  const rawPhase = progress * sceneSpan
  const dwellStart = 0.2
  const dwellEnd = 0.8
  let scenePhase = rawPhase
  let phaseBeat = 0

  if (rawPhase < sceneSpan) {
    const segmentIndex = Math.floor(rawPhase)
    const localPhase = rawPhase - segmentIndex

    if (localPhase <= dwellStart) {
      scenePhase = segmentIndex
      phaseBeat = 0
    } else if (localPhase >= dwellEnd) {
      scenePhase = segmentIndex + 1
      phaseBeat = 0
    } else {
      const transition = (localPhase - dwellStart) / (dwellEnd - dwellStart)
      const easedTransition = transition * transition * (3 - 2 * transition)
      scenePhase = segmentIndex + easedTransition
      phaseBeat = 1 - Math.abs(transition * 2 - 1)
    }
  }

  landingNoiseSection.style.setProperty('--landing-noise-progress', progress.toFixed(4))
  landingNoiseSection.style.setProperty('--landing-noise-phase', scenePhase.toFixed(4))
  landingNoiseSection.style.setProperty('--landing-noise-beat', phaseBeat.toFixed(4))
  const nextIndex = Math.min(
    landingNoiseScenes.length - 1,
    Math.round(scenePhase)
  )

  landingNoiseScenes.forEach((scene, index) => {
    const distance = scenePhase - index
    const visibility = Math.max(0, 1 - Math.abs(distance) / 1.08)
    const easedVisibility = visibility * visibility * (3 - 2 * visibility)
    scene.style.setProperty('--scene-distance', distance.toFixed(4))
    scene.style.setProperty('--scene-visibility', easedVisibility.toFixed(4))
    scene.classList.toggle('is-active', index === nextIndex)
  })

  if (nextIndex !== landingNoiseActiveIndex) {
    landingNoiseActiveIndex = nextIndex
    const activeScene = landingNoiseScenes[nextIndex]

    if (landingNoiseTitle) {
      landingNoiseTitle.textContent = activeScene?.dataset.sceneTitle || ''
    }

    if (landingNoiseCopy) {
      landingNoiseCopy.textContent = activeScene?.dataset.sceneCopy || ''
    }
  }

  if (landingNoiseProgress) {
    landingNoiseProgress.style.setProperty('--landing-noise-progress', progress.toFixed(4))
  }
}

function animateLandingNoiseState() {
  const delta = landingNoiseTargetProgress - landingNoiseVisualProgress

  if (Math.abs(delta) < 0.0006) {
    landingNoiseVisualProgress = landingNoiseTargetProgress
    applyLandingNoiseState(landingNoiseVisualProgress)
    landingNoiseFrame = 0
    return
  }

  landingNoiseVisualProgress += delta * 0.12
  applyLandingNoiseState(landingNoiseVisualProgress)
  landingNoiseFrame = window.requestAnimationFrame(animateLandingNoiseState)
}

function syncLandingNoiseState() {
  if (!landingNoiseSection || !landingNoiseScenes.length) {
    return
  }

  const rect = landingNoiseSection.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const scrollSpan = Math.max(1, rect.height - viewportHeight)
  const rawProgress = Math.min(1, Math.max(0, (-rect.top) / scrollSpan))
  landingNoiseTargetProgress = rawProgress

  if (!landingNoiseFrame) {
    landingNoiseVisualProgress = Math.abs(landingNoiseVisualProgress - landingNoiseTargetProgress) > 0.28
      ? landingNoiseTargetProgress
      : landingNoiseVisualProgress
    landingNoiseFrame = window.requestAnimationFrame(animateLandingNoiseState)
  }
}

function syncLandingCanvasState() {
  if (document.body?.dataset.page !== 'landing' || !landingCanvas) {
    return
  }

  const scrollable = Math.max(
    1,
    (document.documentElement.scrollHeight || 0) - (window.innerHeight || 0)
  )
  const progress = Math.min(1, Math.max(0, window.scrollY / scrollable))
  document.documentElement.style.setProperty('--landing-scroll', progress.toFixed(4))
}

function markActivePlatform(platformKey) {
  platformButtons.forEach((button) => {
    button.dataset.active = button.dataset.platform === platformKey ? 'true' : 'false'
  })
}

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (platform.includes('mac') || ua.includes('mac os')) {
    return 'mac'
  }

  return 'mac'
}

function findAssetForPlatform(platformKey) {
  if (!latestRelease?.assets?.length) {
    return null
  }

  const preset = platformPresets[platformKey]
  if (!preset) {
    return null
  }

  for (const pattern of preset.patterns) {
    const match = latestRelease.assets.find((asset) => pattern.test(asset.name))
    if (match) {
      return match
    }
  }

  return null
}

function setPlatformFallback(platformKey, primaryButtons, label) {
  if (platformKey === 'mac') {
    primaryButtons.forEach((button) => {
      button.textContent = 'Install RoachNet with Homebrew'
      button.onclick = () => {
        window.location.href = 'https://roachnet.org/brew/'
      }
    })
    if (downloadMeta) {
      downloadMeta.textContent =
        'The DMG is missing from the latest release. Homebrew installs the same app into ~/RoachNet.'
    }
    return
  }

  primaryButtons.forEach((button) => {
    button.textContent = `View ${label} release`
    button.onclick = () => {
      window.open(latestReleasePage, '_blank', 'noopener,noreferrer')
    }
  })
  if (downloadMeta) {
    downloadMeta.textContent = `No direct ${label} installer yet. The button opens the latest release instead.`
  }
}

function setPrimaryButton(platformKey) {
  const hostedAsset = hostedDownloads[platformKey]
  const asset = findAssetForPlatform(platformKey)
  const label = platformPresets[platformKey]?.label || 'your system'
  const primaryButtons = [primaryDownloadButton, downloadsPrimaryButton].filter(Boolean)

  if (!primaryButtons.length) {
    return
  }

  activePlatform = platformKey
  markActivePlatform(platformKey)

  if (hostedAsset && (!latestRelease || asset)) {
    primaryButtons.forEach((button) => {
      button.textContent = `Download RoachNet ${hostedAsset.version} for ${label}`
      button.onclick = () => {
        window.location.href = hostedAsset.url
      }
    })
    if (downloadMeta) {
      downloadMeta.textContent = `RoachNet Setup v${hostedAsset.version} · ${hostedAsset.name} · Apple Silicon`
    }
    return
  }

  if (asset) {
    const assetVersion =
      latestRelease?.tag_name?.replace(/^v/i, '') ||
      hostedAsset?.version ||
      releaseVersion
    primaryButtons.forEach((button) => {
      button.textContent = `Download RoachNet ${assetVersion} for ${label}`
      button.onclick = () => {
        window.location.href = asset.browser_download_url
      }
    })
    if (downloadMeta) {
      downloadMeta.textContent = `RoachNet Setup v${assetVersion} · ${asset.name} · Apple Silicon`
    }
    return
  }

  setPlatformFallback(platformKey, primaryButtons, label)
}

function setHomebrewNote(text) {
  if (!homebrewNote) {
    return
  }

  homebrewNote.textContent = text
}

function setInstallStepState(activeStep) {
  document.querySelectorAll('[data-install-step]').forEach((card) => {
    card.dataset.stepActive = String(card.dataset.installStep === String(activeStep))
  })
}

function triggerHomebrewInstall() {
  window.location.href = homebrewHelperUrl
  setInstallStepState(3)
  setHomebrewNote(
    'The helper is downloading. Open the zip, then open RoachNet-Homebrew.command. Terminal takes it from there.'
  )
}

async function copyHomebrewCommand() {
  try {
    await navigator.clipboard.writeText(homebrewCommand)
    setInstallStepState(1)
    setHomebrewNote('Copied. Paste it into Terminal and press Return.')
  } catch (error) {
    console.error(error)
    setHomebrewNote('The browser blocked the clipboard. Copy the command by hand, or use Install with Homebrew.')
  }
}

function formatCompactBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 GB'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function updateHeroTime() {
  if (!heroTime) {
    return
  }

  heroTime.textContent = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
}

function updateConnectivity() {
  if (!heroConnectivity) {
    return
  }

  const isOnline = navigator.onLine
  heroConnectivity.dataset.state = isOnline ? 'online' : 'offline'
  heroConnectivity.textContent = isOnline ? 'Online' : 'Offline, and fine with it'
}

async function updateStorageEstimate() {
  if (!heroStorage) {
    return
  }

  if (!navigator.storage?.estimate) {
    heroStorage.textContent = 'Browser storage unknown'
    return
  }

  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    const available = Math.max(0, quota - usage)

    if (!available) {
      heroStorage.textContent = 'Browser storage unknown'
      return
    }

    heroStorage.textContent = `${formatCompactBytes(available)} free in this browser`
  } catch (error) {
    heroStorage.textContent = 'Browser storage unknown'
    console.error(error)
  }
}

function startHeroTelemetry() {
  updateHeroTime()
  updateConnectivity()
  updateStorageEstimate()

  if (timeTicker) {
    window.clearInterval(timeTicker)
  }

  timeTicker = window.setInterval(updateHeroTime, 30_000)
  window.addEventListener('online', updateConnectivity)
  window.addEventListener('offline', updateConnectivity)
}

function syncHeaderState() {
  if (!siteHeader) {
    return
  }

  siteHeader.dataset.scrolled = window.scrollY > 18 ? 'true' : 'false'
}

async function loadLatestRelease() {
  const detectedPlatform = activePlatform
  if (hostedDownloads[detectedPlatform]) {
    setPrimaryButton(detectedPlatform)
  }

  try {
    const response = await fetch(latestReleaseApi, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    latestRelease = await response.json()
    setPrimaryButton(detectedPlatform)
  } catch (error) {
    if (!hostedDownloads[detectedPlatform]) {
      ;[primaryDownloadButton, downloadsPrimaryButton].filter(Boolean).forEach((button) => {
        button.textContent = 'Open latest release'
        button.onclick = () => {
          window.open(latestReleasePage, '_blank', 'noopener,noreferrer')
        }
      })
      if (downloadMeta) {
        downloadMeta.textContent = 'The release feed is unreachable right now. The button opens the latest release instead.'
      }
    }
    console.error(error)
  }
}

platformButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const platformKey = button.dataset.platform
    activePlatform = platformKey
    markActivePlatform(platformKey)
    const hostedAsset = hostedDownloads[platformKey]
    const asset = findAssetForPlatform(platformKey)

    if (hostedAsset && (!latestRelease || asset)) {
      window.location.href = hostedAsset.url
      return
    }

    if (asset) {
      window.location.href = asset.browser_download_url
      return
    }

    if (platformKey === 'mac') {
      window.location.href = 'https://roachnet.org/brew/'
      return
    }

    window.open(latestReleasePage, '_blank', 'noopener,noreferrer')
  })
})

homebrewInstallButtons.forEach((button) => {
  button.addEventListener('click', triggerHomebrewInstall)
})

homebrewCopyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    void copyHomebrewCommand()
  })
})

landingDownloadButton?.addEventListener('click', triggerLandingDownloadAndRedirect)
startHandedOffDownload()

document.addEventListener(
  'keydown',
  (event) => {
    if (document.body?.dataset.page !== 'landing') {
      return
    }

    if (event.key === 'Shift') {
      setLandingShortcutKeys(['shift'])
      return
    }

    if (event.key === 'Meta') {
      setLandingShortcutKeys(['meta'])
      return
    }

    if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault()
      event.stopPropagation()
      triggerLandingDownloadAndRedirect()
    }
  },
  true
)

document.addEventListener('keyup', (event) => {
  if (document.body?.dataset.page !== 'landing') {
    return
  }

  if (event.key === 'Meta' || event.key === 'Shift' || event.key.toLowerCase() === 'r') {
    setLandingShortcutKeys([])
  }
})

function openCommandPalette() {
  if (!commandPalette) {
    return
  }

  commandPalette.hidden = false
  commandPalette.dataset.state = 'open'
  commandInput?.focus()
  commandInput?.select()
  filterCommandItems('')
}

function closeCommandPalette() {
  if (!commandPalette) {
    return
  }

  commandPalette.dataset.state = 'closed'
  commandPalette.hidden = true
  if (commandInput) {
    commandInput.value = ''
  }
  filterCommandItems('')
}

function visibleCommandItems() {
  return commandItems.filter((item) => !item.hidden)
}

function setSelectedCommandIndex(nextIndex) {
  const visibleItems = visibleCommandItems()
  selectedCommandIndex = visibleItems.length ? Math.max(0, Math.min(nextIndex, visibleItems.length - 1)) : -1

  commandItems.forEach((item) => {
    item.dataset.active = 'false'
    item.setAttribute('aria-selected', 'false')
  })

  if (selectedCommandIndex >= 0) {
    const activeItem = visibleItems[selectedCommandIndex]
    activeItem.dataset.active = 'true'
    activeItem.setAttribute('aria-selected', 'true')
    activeItem.scrollIntoView({ block: 'nearest' })
  }
}

function filterCommandItems(query) {
  const normalized = query.trim().toLowerCase()

  commandItems.forEach((item) => {
    const haystack = (item.dataset.command || '').toLowerCase()
    const matches = !normalized || haystack.includes(normalized)
    item.hidden = !matches
  })

  setSelectedCommandIndex(0)
}

function runCommandItem(item) {
  const action = item.dataset.action
  const scrollTarget = item.dataset.scroll

  if (action === 'download') {
    const asset = findAssetForPlatform(activePlatform)
    const hostedAsset = hostedDownloads[activePlatform] || hostedDownloads.mac

    if (hostedAsset && (!latestRelease || asset)) {
      window.location.href = hostedAsset.url
      closeCommandPalette()
      return
    }

    if (asset) {
      window.location.href = asset.browser_download_url
      closeCommandPalette()
      return
    }

    if (activePlatform === 'mac') {
      window.location.href = 'https://roachnet.org/brew/'
      closeCommandPalette()
      return
    }

    window.open(latestReleasePage, '_blank', 'noopener,noreferrer')
    closeCommandPalette()
    return
  }

  if (action === 'github') {
    window.open(`https://github.com/${owner}/${repo}`, '_blank', 'noopener,noreferrer')
    closeCommandPalette()
    return
  }

  if (scrollTarget) {
    closeCommandPalette()
    document.querySelector(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

commandLaunchButton?.addEventListener('click', openCommandPalette)
commandScrim?.addEventListener('click', closeCommandPalette)

commandInput?.addEventListener('input', (event) => {
  filterCommandItems(event.currentTarget.value)
})

commandInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeCommandPalette()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const visibleItems = visibleCommandItems()
    const activeItem = visibleItems[selectedCommandIndex] || visibleItems[0]
    if (activeItem) {
      runCommandItem(activeItem)
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setSelectedCommandIndex(selectedCommandIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    setSelectedCommandIndex(selectedCommandIndex - 1)
  }
})

commandItems.forEach((item) => {
  item.addEventListener('click', () => {
    runCommandItem(item)
  })

  item.addEventListener('mousemove', () => {
    const visibleItems = visibleCommandItems()
    const nextIndex = visibleItems.indexOf(item)
    if (nextIndex >= 0 && nextIndex !== selectedCommandIndex) {
      setSelectedCommandIndex(nextIndex)
    }
  })
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (commandPalette?.hidden === false) {
      closeCommandPalette()
    } else {
      openCommandPalette()
    }
    return
  }

  if (event.key === 'Escape' && commandPalette?.hidden === false) {
    event.preventDefault()
    closeCommandPalette()
  }
})

syncHeaderState()
syncLandingNoiseState()
syncLandingCanvasState()
window.addEventListener('scroll', syncHeaderState, { passive: true })
window.addEventListener('scroll', syncLandingNoiseState, { passive: true })
window.addEventListener('scroll', syncLandingCanvasState, { passive: true })
window.addEventListener('resize', syncLandingNoiseState, { passive: true })
window.addEventListener('resize', syncLandingCanvasState, { passive: true })
loadLatestRelease()
startHeroTelemetry()
setInstallStepState(1)

;(() => {
  const navShell = document.querySelector('.site-nav, .rn-nav')

  const syncNavShell = () => {
    if (!navShell) return
    navShell.classList.toggle('is-scrolled', window.scrollY > 14)
  }

  window.addEventListener('scroll', syncNavShell, { passive: true })
  syncNavShell()

  const microSelector = [
    '.cta',
    '.rn-btn',
    '.rn-nav-primary',
    '.rn-nav-ghost',
    '.site-header__action',
    '.app-store-card__action',
    '.app-detail-sheet__primary',
    '.app-detail-sheet__secondary',
    '.app-detail-sheet__close',
    '.feature-card',
    '.support-card',
    '.account-mini-card',
    '.app-store-card',
    '.app-store-featured',
    '.apps-toolbar',
    '.app-detail-sheet',
    '.apps-return-strip',
    '.feature-ledger__row',
    '.apps-hero-ledger__item',
    '.api-route-card',
    '.api-docs-hero__meta article',
    '.brew-card',
    '.ios-card',
  ].join(', ')

  document.addEventListener(
    'pointermove',
    (event) => {
      const target = event.target?.closest?.(microSelector)
      if (!target) return
      const rect = target.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)))
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)))
      target.style.setProperty('--rn-hover-x', `${(x * 100).toFixed(2)}%`)
      target.style.setProperty('--rn-hover-y', `${(y * 100).toFixed(2)}%`)
    },
    { passive: true }
  )
})()

/* ── Landing page: scroll progress bar & reveal observer ────────────────── */
;(() => {
  if (document.body?.dataset.page !== 'landing') return

  const progressBar = document.querySelector('.landing-scroll-progress')

  function syncScrollProgress() {
    if (!progressBar) return
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const pct = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100))
    progressBar.style.width = pct.toFixed(2) + '%'
  }

  window.addEventListener('scroll', syncScrollProgress, { passive: true })
  syncScrollProgress()

  const landingReveals = document.querySelectorAll('body[data-page="landing"] [data-reveal]')
  if (!landingReveals.length) return

  if (!('IntersectionObserver' in window)) {
    landingReveals.forEach((el) => el.classList.add('is-visible'))
    return
  }

  const landingRevealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          landingRevealObserver.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  )

  landingReveals.forEach((el) => landingRevealObserver.observe(el))
})()
