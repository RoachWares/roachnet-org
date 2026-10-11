// The account side of the store's Save button (accounts.roachnet.org).
//
// apps.roachnet.org frames this page out of sight and asks it, by postMessage,
// to list, save or remove saved apps. The session stays on this origin: the
// store never sees a token, only whether you are signed in and which apps you
// saved. Only the store's origin is answered, and every row goes through
// Supabase row-level security, so a request can only ever touch your own rows.

import { getSiteAuthState, refreshSiteSession } from './site-account.js'

const channel = 'roachnet-saved-apps'
const allowedParents = new Set(['https://apps.roachnet.org'])
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/
const listLimit = 500
const mergeLimit = 200

function cleanText(value, limit) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit)
}

function cleanIntent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    const text = JSON.stringify(value)
    return text.length <= 4096 ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function rowFor(userId, raw) {
  if (!raw || typeof raw !== 'object') return null
  const appId = String(raw.appId ?? '')
  if (!idPattern.test(appId)) return null
  return {
    user_id: userId,
    app_id: appId,
    title: cleanText(raw.title, 200) || appId,
    category: cleanText(raw.category, 80) || null,
    source: 'apps.roachnet.org',
    install_intent: cleanIntent(raw.installIntent),
  }
}

function reply(origin, id, body) {
  window.parent.postMessage({ channel, v: 1, id, ...body }, origin)
}

async function signedInClient() {
  const auth = await getSiteAuthState()
  if (!auth.enabled || !auth.client) return null
  const session = (await refreshSiteSession()) || auth.session
  return session?.user?.id ? { client: auth.client, userId: session.user.id } : null
}

async function handle(message) {
  const account = await signedInClient()
  if (!account) return { ok: true, signedIn: false }
  const { client, userId } = account

  switch (message.action) {
    case 'list': {
      const { data, error } = await client
        .from('saved_apps')
        .select('app_id, title, category, updated_at')
        .order('updated_at', { ascending: false })
        .limit(listLimit)
      if (error) throw error
      return {
        ok: true,
        signedIn: true,
        items: (data || []).map((row) => ({ appId: row.app_id, title: row.title, category: row.category, updatedAt: row.updated_at })),
      }
    }
    case 'save': {
      const row = rowFor(userId, message.item)
      if (!row) return { ok: false, signedIn: true, error: 'That app id is not valid.' }
      const { error } = await client.from('saved_apps').upsert(row, { onConflict: 'user_id,app_id' })
      if (error) throw error
      return { ok: true, signedIn: true }
    }
    case 'merge': {
      const rows = (Array.isArray(message.items) ? message.items : []).slice(0, mergeLimit).map((item) => rowFor(userId, item)).filter(Boolean)
      if (rows.length) {
        const { error } = await client.from('saved_apps').upsert(rows, { onConflict: 'user_id,app_id', ignoreDuplicates: true })
        if (error) throw error
      }
      return { ok: true, signedIn: true, merged: rows.length }
    }
    case 'remove': {
      const appId = String(message.appId ?? '')
      if (!idPattern.test(appId)) return { ok: false, signedIn: true, error: 'That app id is not valid.' }
      const { error } = await client.from('saved_apps').delete().eq('app_id', appId)
      if (error) throw error
      return { ok: true, signedIn: true }
    }
    default:
      return { ok: false, signedIn: true, error: 'Unknown request.' }
  }
}

if (window.parent !== window) {
  window.addEventListener('message', async (event) => {
    if (!allowedParents.has(event.origin) || event.source !== window.parent) return
    const message = event.data
    if (!message || message.channel !== channel || message.v !== 1) return
    if (typeof message.id !== 'string' || message.id.length > 64) return
    try {
      reply(event.origin, message.id, await handle(message))
    } catch (error) {
      console.warn('Saved apps request failed.', error?.message || error)
      reply(event.origin, message.id, { ok: false, error: 'Your account did not answer, so nothing changed. Try again in a moment.' })
    }
  })

  for (const origin of allowedParents) {
    window.parent.postMessage({ channel, v: 1, type: 'ready' }, origin)
  }
}
