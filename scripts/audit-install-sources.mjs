#!/usr/bin/env node
// Audits every install source the Apps storefront points at, so "installable"
// is a measured statement rather than a hope.
//
//   node scripts/audit-install-sources.mjs [--roachnet <RoachNet repo>] [--live] [--out <dir>]
//
// For every catalog item it resolves the concrete download URLs the native app
// would fetch (same-origin descriptors and their Internet Archive parts, Kiwix
// ZIMs, map tiles, model weights), sends a HEAD (GET with a 0-byte range where
// HEAD is refused), compares sizes with what the descriptors promise, and —
// with --roachnet — checks that the app's bundled collections know the item,
// which is what the install deep link needs on the Mac. --live compares the
// published catalog with this checkout. Writes JSON + Markdown to --out.

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const roachnetRoot = flag('--roachnet')
const outDir = flag('--out') || path.join(repoRoot, 'audit')
const live = args.includes('--live')
const concurrency = Number(flag('--concurrency') || 6)
const timeoutMs = Number(flag('--timeout') || 25_000)

const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'))
const catalog = await readJSON(path.join(repoRoot, 'app-store-catalog.json'))
const siteCollections = {
  kiwix: await readJSON(path.join(repoRoot, 'collections', 'kiwix-categories.json')),
  maps: await readJSON(path.join(repoRoot, 'collections', 'maps.json')),
  wikipedia: await readJSON(path.join(repoRoot, 'collections', 'wikipedia.json')),
}
const appCollections = roachnetRoot ? {
  kiwix: await readJSON(path.join(roachnetRoot, 'collections', 'kiwix-categories.json')),
  maps: await readJSON(path.join(roachnetRoot, 'collections', 'maps.json')),
  wikipedia: await readJSON(path.join(roachnetRoot, 'collections', 'wikipedia.json')),
  models: await readJSON(path.join(roachnetRoot, 'collections', 'native-models.json')),
  packs: await readJSON(path.join(roachnetRoot, 'collections', 'packs.json')).catch(() => null),
} : null

// ---------------------------------------------------------------- resolution

function findResource(collections, categorySlug, resourceId) {
  for (const category of collections.categories || []) {
    if (category.slug !== categorySlug) continue
    for (const tier of category.tiers || []) {
      for (const resource of tier.resources || []) {
        if (resource.id === resourceId) return { category, tier, resource }
      }
    }
  }
  return null
}

function findTier(collections, categorySlug, tierSlug) {
  const category = (collections.categories || []).find((entry) => entry.slug === categorySlug)
  const tier = category?.tiers?.find((entry) => entry.slug === tierSlug)
  return category && tier ? { category, tier } : null
}

function findMapCollection(collections, slug) {
  return (collections.collections || []).find((entry) => entry.slug === slug) || null
}

function findWikipediaOption(collections, optionId) {
  return (collections.options || []).find((entry) => entry.id === optionId) || null
}

/** Concrete URLs the app fetches for one storefront item. */
function resolveItem(item) {
  const intent = item.installIntent || {}
  const urls = []
  const notes = []
  let appKnows = appCollections ? false : null
  switch (intent.action) {
    case 'direct-download':
    case 'roachspeech-pack':
      urls.push({ url: intent.url, role: 'descriptor' })
      appKnows = appCollections ? true : null // resolved at install time from the descriptor
      break
    case 'education-resource': {
      const hit = findResource(siteCollections.kiwix, intent.category, intent.resource)
      if (!hit) notes.push('not in the site collections')
      else urls.push({ url: hit.resource.url, role: 'zim', declaredMb: hit.resource.size_mb })
      if (appCollections) appKnows = Boolean(findResource(appCollections.kiwix, intent.category, intent.resource))
      break
    }
    case 'education-tier': {
      const hit = findTier(siteCollections.kiwix, intent.category, intent.tier)
      if (!hit) notes.push('not in the site collections')
      else for (const resource of hit.tier.resources || []) urls.push({ url: resource.url, role: 'zim', declaredMb: resource.size_mb })
      if (appCollections) appKnows = Boolean(findTier(appCollections.kiwix, intent.category, intent.tier))
      break
    }
    case 'wikipedia-option': {
      const hit = findWikipediaOption(siteCollections.wikipedia, intent.option)
      if (!hit) notes.push('not in the site collections')
      else if (hit.url) urls.push({ url: hit.url, role: 'zim', declaredMb: hit.size_mb })
      if (appCollections) appKnows = Boolean(findWikipediaOption(appCollections.wikipedia, intent.option))
      break
    }
    case 'map-collection': {
      const hit = findMapCollection(siteCollections.maps, intent.slug)
      if (!hit) notes.push('not in the site collections')
      else for (const resource of hit.resources || []) urls.push({ url: resource.url, role: 'pmtiles', declaredMb: resource.size_mb })
      if (appCollections) appKnows = Boolean(findMapCollection(appCollections.maps, intent.slug))
      break
    }
    case 'base-map-assets': {
      const base = siteCollections.maps.base || siteCollections.maps.baseAssets || null
      if (base?.resources) for (const resource of base.resources) urls.push({ url: resource.url, role: 'base-map', declaredMb: resource.size_mb })
      else notes.push('base map assets are resolved by the runtime from its own manifest')
      appKnows = appCollections ? Boolean(appCollections.maps) : null
      break
    }
    case 'pack': {
      // Resolved by the runtime from the published pack catalog; the catalog's
      // own descriptor URL is what gets fetched.
      const packs = appCollections?.packs?.packs || []
      const manifest = packs.find((entry) => entry.id === intent.pack)
      appKnows = appCollections ? Boolean(manifest) : null
      for (const resource of manifest?.resources || []) if (resource.url) urls.push({ url: resource.url, role: 'descriptor' })
      if (!manifest) notes.push('pack id is not in collections/packs.json')
      break
    }
    case 'roachclaw-model': {
      if (appCollections) {
        const model = (appCollections.models.models || []).find((entry) => entry.name === intent.model)
        appKnows = Boolean(model)
        if (model) urls.push({ url: model.url, role: 'gguf', declaredBytes: model.size, sha256: model.sha256 })
        else notes.push('model name is not in the app\'s native-models.json')
      } else {
        notes.push('model URLs come from the app\'s native-models.json (pass --roachnet)')
      }
      break
    }
    default:
      notes.push(`unknown action ${intent.action}`)
  }
  return { urls: urls.filter((entry) => entry.url), notes, appKnows }
}

// ---------------------------------------------------------------- probing

async function probe(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const headers = { 'user-agent': 'RoachNet-apps-audit/1.0 (+https://apps.roachnet.org)' }
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers })
    // Some mirrors answer HEAD with 403/404/405 but serve GET; a 1-byte range
    // is the cheapest honest check.
    if (response.status >= 400) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { ...headers, range: 'bytes=0-0' } })
      try { await response.body?.cancel() } catch {}
    }
    const length = Number(response.headers.get('content-length') || 0)
    const range = response.headers.get('content-range')
    const total = range ? Number(range.split('/')[1]) : (response.status === 206 ? null : length)
    return { status: response.status, ok: response.ok, bytes: total ?? null, finalUrl: response.url, contentType: response.headers.get('content-type') }
  } catch (error) {
    return { status: 0, ok: false, error: String(error?.cause?.message || error?.message || error) }
  } finally {
    clearTimeout(timer)
  }
}

const cache = new Map()
async function probeCached(url) {
  if (!cache.has(url)) cache.set(url, probe(url))
  return cache.get(url)
}

async function fetchDescriptor(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) return { error: `HTTP ${response.status}` }
    return { descriptor: await response.json() }
  } catch (error) {
    return { error: String(error?.message || error) }
  } finally {
    clearTimeout(timer)
  }
}

async function runPool(tasks) {
  const results = new Array(tasks.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  }))
  return results
}

// ---------------------------------------------------------------- main

const items = catalog.items || []
const report = { generatedAt: new Date().toISOString(), catalogUpdatedAt: catalog.updatedAt, items: [], descriptors: [], live: null }

// 1. Resolve and probe item URLs.
const resolved = items.map((item) => ({ item, ...resolveItem(item) }))
const probeTasks = []
for (const entry of resolved) {
  for (const target of entry.urls) {
    if (target.role === 'descriptor') continue
    probeTasks.push(async () => { target.probe = await probeCached(target.url) })
  }
}
await runPool(probeTasks)

// 2. Descriptors: fetch, then probe their parts and sources.
const descriptorTargets = resolved.flatMap((entry) => entry.urls.filter((target) => target.role === 'descriptor').map((target) => ({ entry, target })))
await runPool(descriptorTargets.map(({ entry, target }) => async () => {
  const { descriptor, error } = await fetchDescriptor(target.url)
  const record = { item: entry.item.id, url: target.url, ok: false, error, parts: [], sources: [] }
  if (descriptor) {
    record.sha256 = descriptor.sha256
    record.bytes = descriptor.bytes
    record.status = descriptor.status
    const parts = Array.isArray(descriptor.parts) ? descriptor.parts : []
    let partBytes = 0
    for (const part of parts) {
      const probeResult = await probeCached(part.url)
      const expected = part.encodedBytes ?? part.bytes
      const sizeOk = probeResult.bytes == null || expected == null || probeResult.bytes === expected
      record.parts.push({ url: part.url, expected, actual: probeResult.bytes, status: probeResult.status, ok: probeResult.ok && sizeOk })
      partBytes += part.bytes || 0
    }
    for (const source of Array.isArray(descriptor.sources) ? descriptor.sources : []) {
      if (!source.url || !/^https?:/.test(source.url)) continue
      const probeResult = await probeCached(source.url)
      record.sources.push({ type: source.type, url: source.url, status: probeResult.status, ok: probeResult.ok })
    }
    record.partsBytesOk = parts.length === 0 || partBytes === descriptor.bytes
    record.ok = (parts.length > 0 ? record.parts.every((part) => part.ok) && record.partsBytesOk : record.sources.some((source) => source.ok))
    // The same-origin checksum sidecar must agree with the descriptor.
    if (descriptor.checksumUrl) {
      const sidecar = await (async () => { try { const r = await fetch(descriptor.checksumUrl); return r.ok ? (await r.text()).trim().split(/\s+/)[0] : null } catch { return null } })()
      record.sidecarSha256 = sidecar
      record.sidecarOk = sidecar === descriptor.sha256
      if (!record.sidecarOk) record.ok = false
    }
  }
  target.probe = { status: record.ok ? 200 : 0, ok: record.ok, bytes: record.bytes }
  report.descriptors.push(record)
}))

// 3. Summarise per item.
for (const entry of resolved) {
  const failures = entry.urls.filter((target) => !target.probe?.ok)
  // Sizes on the storefront are whole megabytes (ceil), so a declared value can
  // legitimately differ from the server by up to 1 MB; only larger drifts
  // (>15% and >1 MB) are worth a note.
  const sizeWarnings = entry.urls.filter((target) => target.probe?.ok && target.declaredMb && target.probe.bytes && Math.abs(target.probe.bytes / 1_000_000 - target.declaredMb) > 1 && Math.abs(target.probe.bytes / 1_000_000 - target.declaredMb) / target.declaredMb > 0.15)
  report.items.push({
    availability: entry.item.availability?.state || null,
    id: entry.item.id,
    title: entry.item.title,
    action: entry.item.installIntent?.action,
    section: entry.item.section,
    urls: entry.urls.map((target) => ({ url: target.url, role: target.role, status: target.probe?.status ?? null, ok: Boolean(target.probe?.ok), bytes: target.probe?.bytes ?? null, declaredMb: target.declaredMb ?? null, error: target.probe?.error })),
    reachable: entry.urls.length > 0 && failures.length === 0,
    appKnows: entry.appKnows,
    notes: [...entry.notes, ...sizeWarnings.map((target) => `declared ${target.declaredMb} MB, server says ${(target.probe.bytes / 1_000_000).toFixed(0)} MB`)],
  })
}

// 4. Live catalog comparison.
if (live) {
  try {
    const response = await fetch('https://apps.roachnet.org/app-store-catalog.json', { headers: { accept: 'application/json' } })
    const published = await response.json()
    const localIds = new Set(items.map((item) => item.id))
    const liveIds = new Set((published.items || []).map((item) => item.id))
    report.live = {
      status: response.status,
      publishedUpdatedAt: published.updatedAt,
      localUpdatedAt: catalog.updatedAt,
      onlyLive: [...liveIds].filter((id) => !localIds.has(id)),
      onlyLocal: [...localIds].filter((id) => !liveIds.has(id)),
      count: { live: liveIds.size, local: localIds.size },
    }
  } catch (error) {
    report.live = { error: String(error?.message || error) }
  }
}

// 5. Write.
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'install-sources.json'), JSON.stringify(report, null, 2))
const byAction = new Map()
for (const item of report.items) {
  const bucket = byAction.get(item.action) || { total: 0, reachable: 0, appKnows: 0, appUnknown: 0 }
  bucket.total += 1
  if (item.reachable) bucket.reachable += 1
  if (item.appKnows === true) bucket.appKnows += 1
  if (item.appKnows === false) bucket.appUnknown += 1
  byAction.set(item.action, bucket)
}
const lines = [
  `# Apps storefront install-source audit`,
  ``,
  `Generated ${report.generatedAt} from app-store-catalog.json (updated ${catalog.updatedAt}). ${items.length} items, ${cache.size} distinct URLs probed.`,
  ``,
  `| Action | Items | Sources reachable | Known to the 1.1 app | Unknown to the app |`,
  `| --- | ---: | ---: | ---: | ---: |`,
  ...[...byAction].map(([action, bucket]) => `| ${action} | ${bucket.total} | ${bucket.reachable} | ${appCollections ? bucket.appKnows : '—'} | ${appCollections ? bucket.appUnknown : '—'} |`),
  ``,
  `## Descriptors (same-origin JSON + mirrors)`,
  ``,
  `| Item | Descriptor | Parts | Sidecar | OK |`,
  `| --- | --- | --- | --- | --- |`,
  ...report.descriptors.map((d) => `| ${d.item} | ${d.url.replace('https://apps.roachnet.org', '')} | ${d.parts.filter((p) => p.ok).length}/${d.parts.length}${d.partsBytesOk === false ? ' (size mismatch)' : ''} | ${d.sidecarOk === undefined ? '—' : d.sidecarOk ? 'match' : 'MISMATCH'} | ${d.ok ? 'yes' : 'NO' + (d.error ? ` (${d.error})` : '')} |`),
  ``,
  `## Problems`,
  ``,
]
const problems = report.items.filter((item) => !item.availability && (!item.reachable || item.appKnows === false || item.notes.length))
const flagged = report.items.filter((item) => item.availability)
lines.push(`Flagged on the storefront (install button replaced by the reason): ${flagged.length} — ${[...new Set(flagged.map((item) => item.availability))].join(', ')}`, '')
if (problems.length === 0) lines.push('None.')
for (const item of problems) {
  const bad = item.urls.filter((u) => !u.ok).map((u) => `${u.url} → ${u.status || u.error}`)
  lines.push(`- **${item.id}** (${item.action}, ${item.section}): ${[...(item.reachable ? [] : ['unreachable: ' + bad.join('; ')]), ...(item.appKnows === false ? ['not in the app\'s bundled collections'] : []), ...item.notes].join(' · ')}`)
}
if (report.live) {
  lines.push('', '## Live catalog vs this checkout', '', '```json', JSON.stringify(report.live, null, 2), '```')
}
await writeFile(path.join(outDir, 'install-sources.md'), lines.join('\n') + '\n')
console.log(lines.slice(0, 12).join('\n'))
console.log(`\n${problems.length} item(s) with problems. Full report: ${path.join(outDir, 'install-sources.md')}`)
process.exitCode = report.items.some((item) => !item.availability && !item.reachable) ? 1 : 0
