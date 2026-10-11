// Saved apps for the store (apps.roachnet.org).
//
// Saving always works. If you are signed in on accounts.roachnet.org, picks go
// to your account through a small bridge page on that site, framed out of
// sight here: the account session never leaves its own origin, and the bridge
// only answers this store. If you are signed out (or the bridge can't be
// reached), picks stay in this browser and move into your account the next
// time the store sees you signed in.

const storageKey = 'roachnet.apps.saved.v1'
const storeOrigin = 'https://apps.roachnet.org'
const bridgeOrigin = 'https://accounts.roachnet.org'
const bridgeUrl = `${bridgeOrigin}/saved-apps-bridge.html`
const channel = 'roachnet-saved-apps'
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/
const maxLocal = 500
const readyTimeoutMs = 6000
const callTimeoutMs = 10000

function cleanText(value, limit) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit)
}

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const appId = String(raw.appId ?? '')
  if (!idPattern.test(appId)) return null
  return {
    appId,
    title: cleanText(raw.title, 200) || appId,
    category: cleanText(raw.category, 80),
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt.slice(0, 40) : new Date().toISOString(),
  }
}

// Browser storage can be missing, full or blocked; saving still works for the
// visit, it just isn't remembered.
function readLocal() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    const entries = (Array.isArray(parsed) ? parsed : []).map(cleanEntry).filter(Boolean).slice(0, maxLocal)
    return new Map(entries.map((entry) => [entry.appId, entry]))
  } catch {
    return new Map()
  }
}

function writeLocal(entries) {
  try {
    if (!entries.size) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, JSON.stringify([...entries.values()]))
  } catch {
    // Storage is a convenience here, never a requirement.
  }
}

function entryFor(item) {
  return cleanEntry({
    appId: item.id,
    title: item.title,
    category: item.section || item.category,
    savedAt: new Date().toISOString(),
  })
}

function payloadFor(entry, item) {
  const intent = item?.installIntent && typeof item.installIntent === 'object' ? item.installIntent : {}
  let installIntent = {}
  try {
    installIntent = JSON.stringify(intent).length <= 4096 ? JSON.parse(JSON.stringify(intent)) : {}
  } catch {
    installIntent = {}
  }
  return { appId: entry.appId, title: entry.title, category: entry.category, installIntent }
}

function createBridge() {
  if (window.location.origin !== storeOrigin || window.top !== window) return null

  const frame = document.createElement('iframe')
  frame.src = bridgeUrl
  frame.hidden = true
  frame.title = 'Saved apps sync'
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1

  const pending = new Map()
  let sequence = 0
  let ready = false
  let resolveReady
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve
  })
  const readyTimer = window.setTimeout(() => resolveReady(false), readyTimeoutMs)

  window.addEventListener('message', (event) => {
    if (event.origin !== bridgeOrigin || event.source !== frame.contentWindow) return
    const data = event.data
    if (!data || data.channel !== channel || data.v !== 1) return
    if (data.type === 'ready') {
      ready = true
      window.clearTimeout(readyTimer)
      resolveReady(true)
      return
    }
    const call = pending.get(data.id)
    if (!call) return
    pending.delete(data.id)
    window.clearTimeout(call.timer)
    if (data.ok) call.resolve(data)
    else call.reject(new Error(typeof data.error === 'string' ? data.error : 'The account service did not answer.'))
  })

  document.body.append(frame)

  return {
    ready: () => readyPromise,
    call(action, body = {}) {
      if (!ready || !frame.contentWindow) return Promise.reject(new Error('The account bridge is not ready.'))
      return new Promise((resolve, reject) => {
        sequence += 1
        const id = `s${Date.now().toString(36)}${sequence}`
        const timer = window.setTimeout(() => {
          pending.delete(id)
          reject(new Error('The account service took too long to answer.'))
        }, callTimeoutMs)
        pending.set(id, { resolve, reject, timer })
        frame.contentWindow.postMessage({ channel, v: 1, id, action, ...body }, bridgeOrigin)
      })
    },
  }
}

export function createSavedApps({ onChange = () => {} } = {}) {
  const local = readLocal()
  let account = null // Map of appId -> entry while signed in, otherwise null
  let bridge = null
  let lastSync = 0

  const current = () => account || local
  const notify = () => onChange()

  async function sync() {
    if (!bridge) return
    lastSync = Date.now()
    let listed
    try {
      listed = await bridge.call('list')
    } catch {
      return
    }
    if (!listed.signedIn) {
      if (account) {
        account = null
        notify()
      }
      return
    }

    const fromAccount = new Map(
      (Array.isArray(listed.items) ? listed.items : [])
        .map((row) => cleanEntry({ appId: row.appId, title: row.title, category: row.category, savedAt: row.updatedAt }))
        .filter(Boolean)
        .map((entry) => [entry.appId, entry])
    )
    const waiting = [...local.values()].filter((entry) => !fromAccount.has(entry.appId))
    if (waiting.length) {
      try {
        await bridge.call('merge', { items: waiting.slice(0, 200).map((entry) => payloadFor(entry)) })
        waiting.slice(0, 200).forEach((entry) => fromAccount.set(entry.appId, entry))
        waiting.slice(0, 200).forEach((entry) => local.delete(entry.appId))
        writeLocal(local)
      } catch {
        // Keep them in this browser and try again next time.
        waiting.forEach((entry) => fromAccount.set(entry.appId, entry))
      }
    } else if (local.size) {
      local.clear()
      writeLocal(local)
    }
    account = fromAccount
    notify()
  }

  return {
    has: (id) => current().has(id),
    count: () => current().size,
    ids: () => new Set(current().keys()),
    get signedIn() {
      return Boolean(account)
    },

    async start() {
      bridge = createBridge()
      if (!bridge) return
      if (!(await bridge.ready())) {
        bridge = null
        return
      }
      await sync()
      // Signing in happens on another tab; check again when you come back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastSync > 5000) sync()
      })
    },

    /** Saves or unsaves an item. Resolves to { saved, where: 'account' | 'browser' }. */
    async toggle(item) {
      const entry = entryFor(item)
      if (!entry) throw new Error('That item cannot be saved.')
      const saving = !current().has(entry.appId)

      if (account && bridge) {
        const result = await bridge.call(saving ? 'save' : 'remove', saving ? { item: payloadFor(entry, item) } : { appId: entry.appId })
        if (result.signedIn === false) {
          account = null
        } else {
          if (saving) account.set(entry.appId, entry)
          else account.delete(entry.appId)
          notify()
          return { saved: saving, where: 'account' }
        }
      }

      if (saving) {
        if (local.size >= maxLocal) throw new Error(`This browser holds ${maxLocal} saved apps at most.`)
        local.set(entry.appId, entry)
      } else {
        local.delete(entry.appId)
      }
      writeLocal(local)
      notify()
      return { saved: saving, where: 'browser' }
    },
  }
}
