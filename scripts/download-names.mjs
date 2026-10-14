#!/usr/bin/env node
// Download names: the file names RoachNet gives App Store downloads, checked
// before this catalog publishes them (ROA-95).
//
// RoachNet saves a download under its descriptor's `filename`, or, when a
// collection resource has no descriptor, under the last segment of the
// resource's URL. Releases before 1.1.1 used that name as given: "." or ".."
// made the download's path its destination folder, which the download's
// cleanup then removed, and a failed download removed a file already at its
// path. RoachNet 1.1.1 refuses such names itself. This check keeps the catalog
// from publishing one, so releases that still use names as given never receive
// one. It adds to the app's own checks and never replaces them.
//
//   node scripts/download-names.mjs [checkout]   exits 1 when a name is unsafe

import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DESCRIPTOR_SCHEMA = 'org.roachnet.apps.download-descriptor.v1'
export const INDEX_SCHEMA = 'org.roachnet.apps.download-index.v1'
/** RoachNet shortens a longer name. */
export const MAX_NAME_LENGTH = 160

// The folder RoachNet saves a direct download in, by its file type.
const FOLDERS = { map: 'maps/pmtiles', pmtiles: 'maps/pmtiles', zim: 'zim', knowledge: 'zim', education: 'zim' }

/**
 * Why `name` is unsafe as a download's file name, or null when RoachNet saves
 * it exactly as given, directly inside the destination folder, under a name
 * no download uses for its own temporary files.
 */
export function downloadNameProblem(name) {
  if (typeof name !== 'string' || name === '') return 'is missing'
  if (/^\.+$/.test(name)) return 'is made only of dots, so it names a folder'
  if (/[/\\]/.test(name)) return 'contains a path separator'
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'contains a control character'
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return 'has a character RoachNet replaces (use letters, digits, ".", "_" and "-")'
  if (name.length > MAX_NAME_LENGTH) return `is longer than ${MAX_NAME_LENGTH} characters, so RoachNet shortens it`
  if (name.startsWith('.')) return 'starts with a dot, which makes it a hidden file'
  if (/\.part(\.json)?$/i.test(name)) return 'ends in ".part" or ".part.json", the names of a download\'s partial file and resume marker'
  return null
}

/** One line per problem, for an error message or a terminal. */
export function describeProblems(problems) {
  return problems.map(({ where, problem }) => `- ${where}: ${problem}`).join('\n')
}

const relativeTo = (root, file) => path.relative(root, file).split(path.sep).join('/')
const httpUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value)

/** The descriptor's download URL: its own, or its first web source. */
function downloadUrl(descriptor) {
  if (httpUrl(descriptor.url)) return descriptor.url
  return (Array.isArray(descriptor.sources) ? descriptor.sources : []).find((source) => httpUrl(source?.url))?.url ?? null
}

/** The folder RoachNet saves this descriptor's download in, or null when it saves none there. */
function descriptorFolder(descriptor) {
  const downloadable = downloadUrl(descriptor) !== null || (Array.isArray(descriptor.parts) && descriptor.parts.length > 0)
  if (!downloadable) return null
  if (descriptor.action === 'direct-download') return FOLDERS[String(descriptor.kind || '').toLowerCase()] ?? null
  if (descriptor.action === 'education-resource' || descriptor.action === 'wikipedia-option') return 'zim'
  // A RoachSpeech pack downloads into a folder of its own.
  return null
}

/** The checkout path an apps.roachnet.org download URL serves, or null for any other URL. */
function appsDownloadPath(parsed) {
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'apps.roachnet.org' || !parsed.pathname.startsWith('/downloads/')) return null
  return `downloads/${parsed.pathname.slice('/downloads/'.length)}`
}

/** Every .json file under `directory`. Links are reported, not followed. */
async function jsonFiles(directory, root, report) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    report(relativeTo(root, directory), `can't be read (${error.code || error.message})`)
    return []
  }
  const found = []
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const full = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) report(relativeTo(root, full), 'is a link; the catalog publishes plain files only')
    else if (entry.isDirectory()) found.push(...await jsonFiles(full, root, report))
    else if (entry.isFile() && entry.name.endsWith('.json')) found.push(full)
  }
  return found
}

async function isPlainFile(file) {
  try {
    return (await lstat(file)).isFile()
  } catch {
    return false
  }
}

/**
 * Checks every download name a checkout publishes: the descriptors and
 * indexes under downloads/, the names RoachNet takes from the URLs in
 * collections/, pack resources, and the catalog's download URLs. Within one
 * destination folder, two different downloads may not share a name, compared
 * case-insensitively as Mac volumes usually compare names.
 */
export async function checkDownloadNames(root) {
  const problems = []
  const counts = { files: 0, descriptors: 0, indexEntries: 0, collectionResources: 0, packResources: 0, catalogUrls: 0, savedNames: 0 }
  const report = (where, problem) => problems.push({ where, problem })
  const checkName = (where, name, what = 'filename') => {
    const problem = downloadNameProblem(name)
    if (problem) report(where, `${what} ${JSON.stringify(name ?? null)} ${problem}`)
    return problem === null
  }
  const descriptors = new Map()
  const targets = []

  // 1. Descriptors and indexes under downloads/.
  for (const file of await jsonFiles(path.join(root, 'downloads'), root, report)) {
    const where = relativeTo(root, file)
    counts.files += 1
    let document
    try {
      document = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      report(where, 'is not valid JSON')
      continue
    }
    if (document?.schema === DESCRIPTOR_SCHEMA) {
      counts.descriptors += 1
      descriptors.set(where, document)
      const folder = descriptorFolder(document)
      if (checkName(where, document.filename) && folder) {
        targets.push({ where, folder, name: document.filename, url: downloadUrl(document), sha256: document.sha256 || null })
      }
    } else if (document?.schema === INDEX_SCHEMA) {
      const entries = Array.isArray(document.descriptors) ? document.descriptors : []
      entries.forEach((entry, index) => {
        counts.indexEntries += 1
        checkName(`${where} › descriptors[${index}]`, entry?.filename)
      })
    } else {
      report(where, `has schema ${JSON.stringify(document?.schema ?? null)}, which this check doesn't know; add it to scripts/download-names.mjs before publishing it`)
    }
  }

  const readJSON = async (where) => {
    try {
      return JSON.parse(await readFile(path.join(root, where), 'utf8'))
    } catch (error) {
      report(where, error instanceof SyntaxError ? 'is not valid JSON' : `can't be read (${error.code || error.message})`)
      return null
    }
  }

  // What RoachNet saves a resource as: a descriptor's filename for a
  // descriptor on apps.roachnet.org, otherwise the URL's last segment.
  const resolve = (where, rawUrl, sha256 = null) => {
    if (typeof rawUrl !== 'string' || rawUrl === '') {
      report(where, 'has no URL')
      return null
    }
    let parsed
    try {
      parsed = new URL(rawUrl)
    } catch {
      report(where, `URL ${JSON.stringify(rawUrl)} is not valid`)
      return null
    }
    const served = appsDownloadPath(parsed)
    if (served?.endsWith('.json')) {
      const descriptor = descriptors.get(served)
      if (!descriptor) {
        report(where, `points at ${served}, which this checkout doesn't have`)
        return null
      }
      // A descriptor's own unsafe name is reported once, under its file.
      if (downloadNameProblem(descriptor.filename) !== null) return null
      return { name: descriptor.filename, url: downloadUrl(descriptor), sha256: descriptor.sha256 || sha256 }
    }
    const name = path.posix.basename(parsed.pathname)
    return checkName(where, name, 'URL name') ? { name, url: rawUrl, sha256 } : null
  }
  const addResource = (where, folder, resource) => {
    counts.collectionResources += 1
    const target = resolve(where, resource?.descriptorUrl || resource?.url, resource?.sha256 || null)
    if (target) targets.push({ where, folder, ...target })
  }

  // 2. Collections RoachNet installs from.
  const maps = await readJSON('collections/maps.json')
  for (const collection of maps?.collections || []) {
    for (const resource of collection?.resources || []) {
      addResource(`collections/maps.json › ${collection.slug} › ${resource?.id}`, 'maps/pmtiles', resource)
    }
  }
  const kiwix = await readJSON('collections/kiwix-categories.json')
  for (const category of kiwix?.categories || []) {
    for (const tier of category?.tiers || []) {
      for (const resource of tier?.resources || []) {
        addResource(`collections/kiwix-categories.json › ${category.slug} › ${tier.slug} › ${resource?.id}`, 'zim', resource)
      }
    }
  }
  const wikipedia = await readJSON('collections/wikipedia.json')
  for (const option of wikipedia?.options || []) {
    // The "none" option downloads nothing.
    if (!option?.url && !option?.descriptorUrl) continue
    addResource(`collections/wikipedia.json › ${option.id}`, 'zim', option)
  }

  // 3. Pack resources: each pack downloads into a folder of its own, under the resource's path.
  const packs = await readJSON('collections/packs.json')
  for (const pack of packs?.packs || []) {
    for (const resource of pack?.resources || []) {
      counts.packResources += 1
      const where = `collections/packs.json › ${pack?.id}`
      checkName(where, resource?.path, 'resource path')
      let parsed = null
      try {
        parsed = new URL(resource?.url)
      } catch {
        report(where, `resource URL ${JSON.stringify(resource?.url ?? null)} is not valid`)
      }
      const served = parsed ? appsDownloadPath(parsed) : null
      if (served && !(served.endsWith('.json') ? descriptors.has(served) : await isPlainFile(path.join(root, ...served.split('/'))))) {
        report(where, `resource points at ${served}, which this checkout doesn't have`)
      }
    }
  }

  // 4. The catalog's own download URLs.
  const catalog = await readJSON('app-store-catalog.json')
  for (const item of catalog?.items || []) {
    const intent = item?.installIntent || {}
    if (!intent.url) continue
    counts.catalogUrls += 1
    const where = `app-store-catalog.json › ${item.id}`
    const target = resolve(where, intent.url)
    const folder = intent.action === 'direct-download' ? FOLDERS[String(intent.filetype || '').toLowerCase()] : null
    if (target && folder) targets.push({ where, folder, ...target })
  }

  // 5. One name per file in each folder.
  counts.savedNames = targets.length
  const byName = new Map()
  for (const target of targets) {
    const key = `${target.folder}/${target.name.toLowerCase()}`
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(target)
  }
  for (const [key, group] of byName) {
    const urls = new Set(group.map((target) => target.url))
    const digests = new Set(group.map((target) => target.sha256).filter(Boolean))
    if (urls.size > 1 || digests.size > 1) {
      const places = group.map((target) => target.where)
      const shown = places.length > 4 ? [...places.slice(0, 4), `${places.length - 4} more`] : places
      report(shown.join(', '), `save different files as ${key}; two downloads may not share a name in one folder`)
    }
  }

  return { counts, problems }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const { counts, problems } = await checkDownloadNames(root)
  console.log(`Download names: checked ${counts.descriptors} descriptors, ${counts.indexEntries} index entries, ${counts.collectionResources} collection resources, ${counts.packResources} pack resources and ${counts.catalogUrls} catalog download URLs.`)
  if (problems.length) {
    console.error(`${problems.length} problem(s) (ROA-95):\n${describeProblems(problems)}`)
    process.exitCode = 1
  } else {
    console.log('Every name is one RoachNet saves as given, and no two downloads share a name in one folder.')
  }
}
