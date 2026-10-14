#!/usr/bin/env node
// Download names: the files RoachNet saves from this catalog, checked before
// the catalog publishes them (ROA-95).
//
// RoachNet saves an App Store download under the `filename` of the
// descriptor it resolves (JSON under downloads/). For a collection resource
// it derives that descriptor from the resource URL's last segment, the way
// descriptorUrlForSource does in RoachNet 1.1. Releases before 1.1.1 used the
// name as given: "." made the download's path its destination folder, ".."
// the folder above it, and the download's cleanup then removed that folder;
// a failed download also removed a file already at its path. RoachNet 1.1.1
// refuses such names itself. This check keeps the catalog from publishing
// one, so releases that still use names as given never receive one. It adds
// to the app's own checks and never replaces them.
//
//   node scripts/download-names.mjs [checkout]   exits 1 on a problem

import { createHash } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DESCRIPTOR_SCHEMA = 'org.roachnet.apps.download-descriptor.v1'
export const INDEX_SCHEMA = 'org.roachnet.apps.download-index.v1'
/** RoachNet shortens a longer name. */
export const MAX_NAME_LENGTH = 160

const APPS_ORIGIN = 'https://apps.roachnet.org'
// Where RoachNet saves each kind of download, under its storage folder.
const MAPS = 'maps/pmtiles'
const ZIM = 'zim'
// A direct download's folder, by its file type (handleCompanionInstall).
const DIRECT_FOLDERS = { map: MAPS, pmtiles: MAPS, zim: ZIM, knowledge: ZIM, education: ZIM }
// Files RoachNet keeps in a download folder itself.
const RESERVED = { [ZIM]: ['wikipedia-selection.json'] }
// The descriptor RoachNet 1.1 queues for the World Atlas (base-map-assets).
const WORLD_ATLAS = 'downloads/maps/pmtiles/global-min_2026-10.json'
// Descriptors of first-party files, which always carry their SHA-256.
const CHECKSUMMED = ['downloads/maps/pmtiles/', 'downloads/model-packs/']

/**
 * Why `name` is unsafe as a download's file name, or null when RoachNet saves
 * it exactly as given, directly inside the destination folder, under a name
 * no download uses for its own temporary files.
 */
export function downloadNameProblem(name) {
  if (typeof name !== 'string' || name === '') return 'is missing'
  if (/^\.+$/.test(name)) return 'is made only of dots, so it names a folder'
  if (/[/\\]/.test(name)) return 'contains a path separator'
  if ([...name].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)) return 'contains a control character'
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
const isDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

// How RoachNet 1.1 reads a catalog URL (parseDownloadUrl): trimmed, web only.
export function webUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

// The checkout file behind a descriptor URL RoachNet opens and follows
// (isAppsDownloadDescriptorUrl): a .json file under the Apps downloads base,
// on exactly that origin. Any other URL downloads as the file it names.
export function descriptorFile(parsed) {
  if (!parsed || parsed.origin !== APPS_ORIGIN || !parsed.pathname.startsWith('/downloads/') || !parsed.pathname.endsWith('.json')) return null
  return `downloads/${parsed.pathname.slice('/downloads/'.length)}`
}

// The descriptor URL RoachNet derives for a collection resource
// (descriptorUrlForSource): the URL's last segment, extension made .json,
// under downloads/<prefix>/. Null when the URL has no last segment.
export function derivedDescriptorUrl(url, prefix) {
  const name = path.posix.basename(url.pathname)
  return name === '' ? null : `${APPS_ORIGIN}/downloads/${prefix}/${name.replace(/\.[^/.]+$/i, '.json')}`
}

// What RoachNet downloads for a descriptor (pickDescriptorSource and
// descriptorParts): its chunked parts when a parts source is usable, else
// its first usable web source, else its own url. Null when it has none.
export function descriptorDownload(descriptor, descriptorUrl) {
  const unusable = /(pending|required|blocked|failed)/i
  const sources = Array.isArray(descriptor.sources) ? descriptor.sources : []
  const status = (source) => (source?.status ? String(source.status) : '')
  const partsSource = sources.some((source) => source?.type === 'internet-archive-parts' && status(source) !== '' && !unusable.test(status(source)))
  const parts = Array.isArray(descriptor.parts) ? descriptor.parts : []
  if (partsSource && parts.length > 0 && parts.every((part) => webUrl(part?.url) && Number.isSafeInteger(part?.bytes) && part.bytes > 0)) {
    return descriptorUrl
  }
  for (const source of sources) {
    if (source?.type === 'internet-archive-parts' || unusable.test(status(source))) continue
    const parsed = webUrl(source?.url)
    if (parsed) return parsed.href
  }
  return (webUrl(descriptor.url) || webUrl(descriptor.downloadUrl) || webUrl(descriptor.archiveUrl))?.href ?? null
}

// The name RoachNet saves a descriptor's download under: its filename, or
// without one, the last segment of the address it downloads from.
function savedName(descriptor, address) {
  if (descriptor.filename) return descriptor.filename
  return path.posix.basename(new URL(address).pathname)
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

/** A checkout file's size and SHA-256, or null when it isn't a plain file. */
async function fileDigest(file) {
  try {
    if (!(await lstat(file)).isFile()) return null
    const data = await readFile(file)
    return { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }
  } catch {
    return null
  }
}

const short = (digest) => (isDigest(digest) ? `${digest.slice(0, 12)}…` : 'none')

/**
 * Checks every file name a checkout gives RoachNet: every JSON file under
 * downloads/, and what RoachNet saves for each install the catalog offers
 * (the catalog's direct downloads and speech packs, the World Atlas, and the
 * resources of collections/maps.json, kiwix-categories.json and
 * wikipedia.json), resolved the way RoachNet 1.1 resolves them. Within one
 * folder, two different downloads may not share a name, compared
 * case-insensitively as Mac volumes usually compare names. First-party
 * descriptors must keep the SHA-256 RoachNet checks, and pack resources
 * must match what packs.json lists.
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
  const readJSON = async (where) => {
    try {
      return JSON.parse(await readFile(path.join(root, where), 'utf8'))
    } catch (error) {
      report(where, error instanceof SyntaxError ? 'is not valid JSON' : `can't be read (${error.code || error.message})`)
      return null
    }
  }

  // 1. Every JSON file under downloads/. RoachNet opens whichever of them an
  //    install points at, whatever its schema, so a filename is checked
  //    wherever one appears.
  const documents = new Map()
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
    if (document === null || typeof document !== 'object' || Array.isArray(document)) {
      report(where, 'is not a JSON object')
      continue
    }
    documents.set(where, document)
    if (document.schema === DESCRIPTOR_SCHEMA) {
      counts.descriptors += 1
      checkName(where, document.filename)
      if (CHECKSUMMED.some((prefix) => where.startsWith(prefix)) && !(isDigest(document.sha256) && Number.isSafeInteger(document.bytes) && document.bytes > 0)) {
        report(where, 'has no SHA-256 and size, so RoachNet would not check what it downloads')
      }
      continue
    }
    if (document.schema === INDEX_SCHEMA) {
      const entries = Array.isArray(document.descriptors) ? document.descriptors : []
      entries.forEach((entry, index) => {
        counts.indexEntries += 1
        checkName(`${where} › descriptors[${index}]`, entry?.filename)
      })
    } else {
      report(where, `has schema ${JSON.stringify(document.schema ?? null)}, which this check doesn't know; add it to scripts/download-names.mjs before publishing it`)
    }
    if ('filename' in document) checkName(where, document.filename)
  }

  // 2. What RoachNet saves for each install, by folder.
  const targets = []
  const addTarget = (target) => {
    if ((RESERVED[target.folder] || []).includes(target.name.toLowerCase())) {
      report(target.where, `saves ${target.folder}/${target.name}, a file RoachNet keeps there itself`)
      return null
    }
    targets.push(target)
    return target
  }
  // RoachNet queues `rawUrl` into `folder`: a descriptor on apps.roachnet.org
  // is opened and followed, any other URL downloads as the file it names.
  const resolve = (where, folder, rawUrl) => {
    const parsed = webUrl(rawUrl)
    if (!parsed) {
      report(where, `URL ${JSON.stringify(rawUrl ?? null)} is not a web address RoachNet can download`)
      return null
    }
    const file = descriptorFile(parsed)
    if (!file) {
      const name = path.posix.basename(parsed.pathname)
      return checkName(where, name, 'URL name') ? addTarget({ where, folder, name, address: parsed.href, sha256: null, file: null }) : null
    }
    const descriptor = documents.get(file)
    if (!descriptor) {
      report(where, `RoachNet looks for ${file}, which this checkout doesn't have`)
      return null
    }
    const address = descriptorDownload(descriptor, parsed.href)
    if (!address) {
      report(where, `${file} names nothing RoachNet can download`)
      return null
    }
    const name = savedName(descriptor, address)
    if (downloadNameProblem(name) !== null) {
      // A descriptor's own unsafe filename is reported once, under its file.
      if (!descriptor.filename) checkName(where, name, `${file} has no filename, and the name from its address`)
      return null
    }
    return addTarget({ where, folder, name, address, sha256: isDigest(descriptor.sha256) ? descriptor.sha256 : null, file })
  }

  // 3. Collections. RoachNet ignores a resource's own descriptorUrl and
  //    checksum: it derives the descriptor from the URL's last segment and
  //    checks what that descriptor lists. Withdrawn resources aren't offered.
  const fromCollection = (where, folder, prefix, resource) => {
    counts.collectionResources += 1
    const parsed = webUrl(resource?.url)
    if (!parsed) {
      report(where, `URL ${JSON.stringify(resource?.url ?? null)} is not a web address RoachNet can download`)
      return
    }
    const derived = derivedDescriptorUrl(parsed, prefix)
    if (!derived) {
      report(where, `URL ${resource.url} names no file, so RoachNet gives the download a generated name`)
      return
    }
    const target = resolve(where, folder, derived)
    // The checksum the collection lists is the one its descriptor must carry.
    if (target && isDigest(resource.sha256) && target.sha256 !== resource.sha256) {
      report(where, `lists SHA-256 ${short(resource.sha256)}, but ${target.file ?? 'its download'} has ${short(target.sha256)}`)
    }
  }
  const offered = (entry) => entry && !entry.unavailable
  const maps = await readJSON('collections/maps.json')
  for (const collection of maps?.collections || []) {
    for (const resource of (collection?.resources || []).filter(offered)) {
      fromCollection(`collections/maps.json › ${collection.slug} › ${resource.id}`, MAPS, 'maps/pmtiles', resource)
    }
  }
  const kiwix = await readJSON('collections/kiwix-categories.json')
  for (const category of kiwix?.categories || []) {
    for (const tier of category?.tiers || []) {
      for (const resource of (tier?.resources || []).filter(offered)) {
        fromCollection(`collections/kiwix-categories.json › ${category.slug} › ${tier.slug} › ${resource.id}`, ZIM, 'content/zim', resource)
      }
    }
  }
  const wikipedia = await readJSON('collections/wikipedia.json')
  for (const option of (wikipedia?.options || []).filter(offered)) {
    // The "none" option downloads nothing.
    if (option.id === 'none' || !option.url) continue
    fromCollection(`collections/wikipedia.json › ${option.id}`, ZIM, 'content/wikipedia', option)
  }

  // 4. Pack resources. Each pack downloads into a folder of its own, under
  //    the resource's path, and checks the size and SHA-256 packs.json lists.
  const packs = await readJSON('collections/packs.json')
  for (const pack of packs?.packs || []) {
    for (const resource of pack?.resources || []) {
      counts.packResources += 1
      const where = `collections/packs.json › ${pack?.id}`
      for (const part of typeof resource?.path === 'string' ? resource.path.split('/') : [null]) {
        const problem = downloadNameProblem(part)
        if (problem) {
          report(where, `resource path ${JSON.stringify(resource?.path ?? null)} has a part ${JSON.stringify(part ?? null)} that ${problem}`)
          break
        }
      }
      const parsed = webUrl(resource?.url)
      if (!parsed) {
        report(where, `resource URL ${JSON.stringify(resource?.url ?? null)} is not a web address RoachNet can download`)
        continue
      }
      if (parsed.origin !== APPS_ORIGIN || !parsed.pathname.startsWith('/downloads/')) continue
      const file = `downloads/${parsed.pathname.slice('/downloads/'.length)}`
      const listed = `${short(resource.sha256)}, ${resource.bytes} bytes`
      if (file.endsWith('.json')) {
        const descriptor = documents.get(file)
        if (!descriptor) report(where, `resource points at ${file}, which this checkout doesn't have`)
        else if (descriptor.sha256 !== resource.sha256 || descriptor.bytes !== resource.bytes) {
          report(where, `resource lists ${listed}, but ${file} has ${short(descriptor.sha256)}, ${descriptor.bytes} bytes`)
        }
      } else {
        const actual = await fileDigest(path.join(root, ...file.split('/')))
        if (!actual) report(where, `resource points at ${file}, which this checkout doesn't have`)
        else if (actual.sha256 !== resource.sha256 || actual.bytes !== resource.bytes) {
          report(where, `resource lists ${listed}, but ${file} is ${short(actual.sha256)}, ${actual.bytes} bytes`)
        }
      }
    }
  }

  // 5. The installs RoachNet makes from the catalog, and the World Atlas,
  //    which RoachNet 1.1 queues on its own for base map assets.
  resolve('the World Atlas RoachNet 1.1 queues', MAPS, `${APPS_ORIGIN}/${WORLD_ATLAS}`)
  const catalog = await readJSON('app-store-catalog.json')
  for (const item of catalog?.items || []) {
    const intent = item?.installIntent || {}
    const where = `app-store-catalog.json › ${item?.id}`
    if (intent.action === 'direct-download' && intent.url) {
      counts.catalogUrls += 1
      const folder = DIRECT_FOLDERS[String(intent.filetype || '').toLowerCase()]
      if (folder) resolve(where, folder, intent.url)
      else report(where, `file type ${JSON.stringify(intent.filetype ?? null)} is not one RoachNet downloads`)
    } else if ((intent.action === 'roachspeech-pack' || intent.action === 'roachvoice-pack') && intent.url) {
      counts.catalogUrls += 1
      // RoachNet makes the pack's download folder from these two.
      const pack = intent.packID || intent.pack || 'roachspeech-pack'
      const kind = intent.kind || 'roachVoice'
      const packSafe = checkName(where, pack, 'pack id')
      const kindSafe = checkName(where, kind, 'pack kind')
      if (packSafe && kindSafe) resolve(where, `RoachSpeech/ModelPacks/.downloads/${kind}/${pack}`, intent.url)
    }
  }

  // 6. One name per file in each folder.
  counts.savedNames = targets.length
  const byName = new Map()
  for (const target of targets) {
    const key = `${target.folder}/${target.name.toLowerCase()}`
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(target)
  }
  for (const [key, group] of byName) {
    const addresses = new Set(group.map((target) => target.address))
    const digests = new Set(group.map((target) => target.sha256 ?? 'none'))
    if (addresses.size > 1 || digests.size > 1) {
      const places = [...new Set(group.map((target) => target.where))]
      const shown = places.length > 4 ? [...places.slice(0, 4), `${places.length - 4} more`] : places
      report(shown.join(', '), `save different files as ${key}; two downloads may not share a name in one folder`)
    }
  }

  return { counts, problems }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const { counts, problems } = await checkDownloadNames(root)
  console.log(`Download names: checked ${counts.files} files under downloads/ (${counts.descriptors} descriptors, ${counts.indexEntries} index entries), ${counts.collectionResources} collection resources, ${counts.packResources} pack resources and ${counts.catalogUrls} catalog downloads, which save ${counts.savedNames} files.`)
  if (problems.length) {
    console.error(`${problems.length} problem(s) (ROA-95):\n${describeProblems(problems)}`)
    process.exitCode = 1
  } else {
    console.log('Every name is one RoachNet saves as given, no two downloads share a name in one folder, and every checksum RoachNet checks is in place.')
  }
}
