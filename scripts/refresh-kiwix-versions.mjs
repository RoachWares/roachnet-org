#!/usr/bin/env node
// Re-pins every Kiwix ZIM in the collections to the build the Kiwix library
// currently serves. Kiwix keeps only recent monthly builds, so a catalog that
// names dates goes stale; this asks library.kiwix.org for each title by its
// stable name and rewrites url, version and size_mb. Titles the library no
// longer lists are flagged `unavailable: true` (and reported) rather than
// deleted, so the storefront can say so instead of offering a dead link.
//
//   node scripts/refresh-kiwix-versions.mjs [--dry-run] [--concurrency 6]

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const concurrency = Number(args[args.indexOf('--concurrency') + 1] || 6)

const files = {
  kiwix: path.join(repoRoot, 'collections', 'kiwix-categories.json'),
  wikipedia: path.join(repoRoot, 'collections', 'wikipedia.json'),
}

const zimPattern = /^(https:\/\/download\.kiwix\.org\/zim\/[^/]+\/)([A-Za-z0-9._-]+?)_(\d{4}-\d{2})\.zim$/

// Kiwix's library names a book without its flavour: `wikipedia_en_all_maxi_2026-02.zim`
// is name `wikipedia_en_all`, flavour `maxi`.
const flavours = ['maxi', 'mini', 'nopic', 'novid', 'nodet']

function parseZimUrl(url) {
  const match = zimPattern.exec(url || '')
  if (!match) return null
  let name = match[2]
  let flavour = ''
  for (const candidate of flavours) {
    if (name.endsWith(`_${candidate}`)) {
      flavour = candidate
      name = name.slice(0, -(candidate.length + 1))
      break
    }
  }
  return { folder: match[1], name, flavour, version: match[3], fullName: match[2] }
}

// Books Kiwix renamed since the collection was written: old name → current name.
const renamedBooks = {
  'docs.python.org_en': 'docs.python.org_en_all',
  'wiktionary_en_simple_all': 'wiktionary_en-simple_all',
  'fas-military-medicine_en': 'irp.fas.org_en_military-medicine',
  'canadian_prepper_winterprepping_en': 'canadian-prepper_en_winterprepping',
  'canadian_prepper_preppingfood_en': 'canadian-prepper_en_preppingfood',
  'canadian_prepper_bugoutconcepts_en': 'canadian-prepper_en_bugoutconcepts',
  'canadian_prepper_bugoutroll_en': 'canadian-prepper_en_bugoutroll',
}

const libraryCache = new Map()

/** Latest entry for a Kiwix book name: { url, version, bytes } or null. */
async function lookup(name, flavour = '') {
  const key = `${name}|${flavour}`
  if (libraryCache.has(key)) return libraryCache.get(key)
  const promise = (async () => {
    const endpoint = `https://library.kiwix.org/catalog/v2/entries?name=${encodeURIComponent(name)}`
    const response = await fetch(endpoint, { redirect: 'follow', headers: { accept: 'application/atom+xml' } })
    if (!response.ok) throw new Error(`library ${response.status} for ${name}`)
    const xml = await response.text()
    // One <entry> per book; match the exact name, not a prefix (devdocs_en_c vs devdocs_en_c++).
    const entries = xml.split('<entry>').slice(1)
    for (const entry of entries) {
      const entryName = /<name>([^<]*)<\/name>/.exec(entry)?.[1]
      const entryFlavour = /<flavour>([^<]*)<\/flavour>/.exec(entry)?.[1] || ''
      if (entryName !== name || entryFlavour !== flavour) continue
      const link = /<link[^>]*rel="http:\/\/opds-spec\.org\/acquisition\/open-access"[^>]*href="([^"]+)"[^>]*length="(\d+)"/.exec(entry)
        || /<link[^>]*href="([^"]+\.zim\.meta4)"[^>]*length="(\d+)"/.exec(entry)
      if (!link) return null
      const href = link[1].replace(/\.meta4$/, '').replace('https://lb.download.kiwix.org/', 'https://download.kiwix.org/')
      const version = /_(\d{4}-\d{2})\.zim$/.exec(href)?.[1] || null
      return { url: href, version, bytes: Number(link[2]) }
    }
    return null
  })()
  libraryCache.set(key, promise)
  return promise
}

async function runPool(tasks) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) await tasks[next++]()
  }))
}

const report = { updated: [], current: [], unavailable: [], skipped: [], errors: [] }

async function refreshResource(resource, where) {
  const parsed = parseZimUrl(resource.url)
  if (!parsed) {
    if (resource.url) report.skipped.push(`${where}: ${resource.url}`)
    return
  }
  try {
    let latest = null
    for (let attempt = 0; attempt < 3 && latest === null; attempt += 1) {
      try { latest = await lookup(renamedBooks[parsed.name] || parsed.name, parsed.flavour) } catch (error) { if (attempt === 2) throw error; await new Promise((r) => setTimeout(r, 1500)) }
    }
    if (!latest) {
      resource.unavailable = true
      report.unavailable.push(`${where}: ${parsed.fullName} (${parsed.version})`)
      return
    }
    delete resource.unavailable
    const sizeMb = Math.max(1, Math.round(latest.bytes / 1_000_000))
    if (latest.url === resource.url && resource.size_mb === sizeMb) {
      report.current.push(`${where}: ${parsed.fullName} ${parsed.version}`)
      return
    }
    report.updated.push(`${where}: ${parsed.fullName} ${parsed.version} → ${latest.version} (${sizeMb} MB)`)
    resource.url = latest.url
    if (latest.version) resource.version = latest.version
    resource.size_mb = sizeMb
  } catch (error) {
    report.errors.push(`${where}: ${parsed.fullName}: ${error.message}`)
  }
}

const kiwix = JSON.parse(await readFile(files.kiwix, 'utf8'))
const wikipedia = JSON.parse(await readFile(files.wikipedia, 'utf8'))

const tasks = []
for (const category of kiwix.categories || []) {
  for (const tier of category.tiers || []) {
    for (const resource of tier.resources || []) {
      tasks.push(() => refreshResource(resource, `${category.slug}/${tier.slug}/${resource.id}`))
    }
  }
}
for (const option of wikipedia.options || []) {
  if (option.url) tasks.push(() => refreshResource(option, `wikipedia/${option.id}`))
}
await runPool(tasks)

const stamp = new Date().toISOString().slice(0, 10)
if (!dryRun) {
  kiwix.spec_version = stamp
  kiwix.refreshedAt = new Date().toISOString()
  wikipedia.spec_version = stamp
  wikipedia.refreshedAt = kiwix.refreshedAt
  await writeFile(files.kiwix, JSON.stringify(kiwix, null, 2) + '\n')
  await writeFile(files.wikipedia, JSON.stringify(wikipedia, null, 2) + '\n')
}

console.log(`${tasks.length} ZIM references checked against library.kiwix.org${dryRun ? ' (dry run)' : ''}`)
console.log(`  current:     ${report.current.length}`)
console.log(`  re-pinned:   ${report.updated.length}`)
console.log(`  unavailable: ${report.unavailable.length}`)
console.log(`  skipped:     ${report.skipped.length}`)
console.log(`  errors:      ${report.errors.length}`)
for (const line of report.updated) console.log(`  ~ ${line}`)
for (const line of report.unavailable) console.log(`  ✖ ${line}`)
for (const line of report.errors) console.log(`  ! ${line}`)
process.exitCode = report.errors.length > 0 ? 1 : 0
