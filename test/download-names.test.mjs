import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  checkDownloadNames, derivedDescriptorUrl, descriptorDownload, descriptorFile, DESCRIPTOR_SCHEMA, downloadNameProblem, INDEX_SCHEMA, MAX_NAME_LENGTH, webUrl,
} from '../scripts/download-names.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const char = (code) => String.fromCharCode(code)

// RoachNet 1.1.1's own rule (safeFileName in RoachClawStatus.swift): the name
// it saves `value` under, or null when it uses a generated name instead.
function roachNetName(value) {
  let cleaned = String(value ?? '').trim()
  cleaned = cleaned.replace(/[^A-Za-z0-9_.\- ]+/g, '_').replace(/\s+/g, '-').slice(0, 160)
  return cleaned === '' || /^\.+$/.test(cleaned) ? null : cleaned
}

const unsafe = [
  '', '.', '..', '...',
  '../x.zim', 'a/b.zim', 'a\\b.zim', '/x.zim',
  `x${char(0)}.zim`, 'x\n.zim', 'x\t.zim',
  ' x.zim', 'x.zim ', 'x y.zim', `caf${char(0xe9)}.zim`, `cafe${char(0x301)}.zim`, `x${char(0x200b)}.zim`, '%2e%2e', 'x:y.zim',
  'a'.repeat(MAX_NAME_LENGTH + 1),
  '.hidden.zim', '.DS_Store',
  'x.part', 'x.PART', 'map.pmtiles.part', 'x.part.json', 'X.Part.Json',
  null, undefined, 42, ['x.zim'], { name: 'x.zim' },
]

const safe = [
  'north_dakota_2026-10.pmtiles', 'wikipedia_en_all_maxi_2026-01.zim', 'manifest.bin', 'roachwhisper-openai-whisper-base-en-coreml.zip',
  'x..zim', 'v1.0.0.zip', 'x.partial', 'x.part1', 'x.part.zip', 'part.zim', 'x.json', 'a'.repeat(MAX_NAME_LENGTH),
]

test('a download name RoachNet would misread, shorten or change is refused', () => {
  for (const name of unsafe) assert.notEqual(downloadNameProblem(name), null, `accepted ${JSON.stringify(name)}`)
})

test('each refusal says why', () => {
  assert.match(downloadNameProblem(null), /is missing/)
  assert.match(downloadNameProblem('..'), /only of dots/)
  assert.match(downloadNameProblem('a/b.zim'), /path separator/)
  assert.match(downloadNameProblem(`x${char(0)}.zim`), /control character/)
  assert.match(downloadNameProblem('x y.zim'), /character RoachNet replaces/)
  assert.match(downloadNameProblem('a'.repeat(MAX_NAME_LENGTH + 1)), /longer than 160/)
  assert.match(downloadNameProblem('.hidden.zim'), /hidden file/)
  assert.match(downloadNameProblem('x.part.json'), /partial file and resume marker/)
})

test('a download name RoachNet saves exactly as given is accepted', () => {
  for (const name of safe) {
    assert.equal(downloadNameProblem(name), null, JSON.stringify(name))
    assert.equal(roachNetName(name), name)
  }
})

test('every accepted name is one RoachNet saves unchanged', () => {
  // Every string of up to three characters from the characters that matter.
  const alphabet = ['a', 'Z', '0', '.', '-', '_', ' ', '/', '\\', char(0), char(0xe9), '%', 'p']
  let accepted = 0
  const visit = (name, depth) => {
    if (downloadNameProblem(name) === null) {
      accepted += 1
      assert.equal(roachNetName(name), name, `RoachNet would save ${JSON.stringify(name)} differently`)
    }
    if (depth < 3) for (const character of alphabet) visit(name + character, depth + 1)
  }
  visit('', 0)
  assert.ok(accepted > 100, `only ${accepted} names accepted`)
})

test('a descriptor is a .json file under the Apps downloads folder, on exactly that origin', () => {
  const file = (url) => descriptorFile(webUrl(url))
  assert.equal(file('https://apps.roachnet.org/downloads/maps/pmtiles/a.json'), 'downloads/maps/pmtiles/a.json')
  assert.equal(file('  https://apps.roachnet.org/downloads/a.json?x=1  '), 'downloads/a.json')
  assert.equal(file('HTTPS://APPS.ROACHNET.ORG/downloads/a.json'), 'downloads/a.json')
  for (const other of [
    'http://apps.roachnet.org/downloads/a.json', 'https://apps.roachnet.org:8443/downloads/a.json', 'https://example.org/downloads/a.json',
    'https://apps.roachnet.org/downloadsx/a.json', 'https://apps.roachnet.org/collections/a.json', 'https://apps.roachnet.org/downloads/a.zip',
    'ftp://apps.roachnet.org/downloads/a.json', 'not a url',
  ]) {
    assert.equal(file(other), null, other)
  }
})

test('a collection resource leads RoachNet to the descriptor named after its file', () => {
  const derive = (url, prefix) => derivedDescriptorUrl(new URL(url), prefix)
  assert.equal(derive('https://download.kiwix.org/zim/x/fine_2026-01.zim', 'content/zim'), 'https://apps.roachnet.org/downloads/content/zim/fine_2026-01.json')
  assert.equal(derive('https://mirror.example.org/a/fine_2026-01.ZIM?download=1', 'content/zim'), 'https://apps.roachnet.org/downloads/content/zim/fine_2026-01.json')
  assert.equal(derive('https://github.com/o/r/releases/download/t/ohio_2026-10.pmtiles', 'maps/pmtiles'), 'https://apps.roachnet.org/downloads/maps/pmtiles/ohio_2026-10.json')
  assert.equal(derive('https://example.org/files/noext', 'content/zim'), 'https://apps.roachnet.org/downloads/content/zim/noext')
  assert.equal(derive('https://example.org/', 'content/zim'), null)
})

test('RoachNet downloads a descriptor\'s usable parts, else its first usable source', () => {
  const self = 'https://apps.roachnet.org/downloads/model-packs/x.json'
  const parts = [{ url: 'https://archive.org/download/i/x.rnpart0001', bytes: 4 }]
  const partsSource = (status) => ({ type: 'internet-archive-parts', url: 'https://archive.org/details/i', status })
  assert.equal(descriptorDownload({ sources: [partsSource('published-after-upload')], parts }, self), self)
  // Parts not yet published, or listed without a size, aren't used.
  assert.equal(descriptorDownload({ sources: [partsSource('upload-required'), { type: 'internet-archive', url: 'https://archive.org/download/i/x.zip', status: 'single-object-pending' }], parts, url: 'https://example.org/x.zip' }, self), 'https://example.org/x.zip')
  assert.equal(descriptorDownload({ sources: [partsSource('published')], parts: [{ url: 'https://archive.org/p1' }] }, self), null)
  // RoachNet reads a size given as a string as a number.
  assert.equal(descriptorDownload({ sources: [partsSource('published')], parts: [{ url: 'https://archive.org/p1', bytes: '4' }] }, self), self)
  // Pending, required, blocked and failed sources are skipped, whatever their case.
  assert.equal(descriptorDownload({ sources: [{ type: 'internet-archive', url: 'https://archive.org/a', status: 'mirror-PENDING' }, { type: 'public-source', url: ' https://example.org/b ', status: 'active' }] }, self), 'https://example.org/b')
  assert.equal(descriptorDownload({ sources: [{ type: 'github-release', url: 'https://example.org/c', status: 'Blocked' }], url: 'https://example.org/d' }, self), 'https://example.org/d')
  assert.equal(descriptorDownload({ sources: [], downloadUrl: 'https://example.org/e' }, self), 'https://example.org/e')
  assert.equal(descriptorDownload({ sources: [{ type: 'public-source', url: 'ftp://example.org/f' }] }, self), null)
})

async function countJsonFiles(directory) {
  let count = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countJsonFiles(path.join(directory, entry.name))
    else if (entry.name.endsWith('.json')) count += 1
  }
  return count
}

test('this checkout publishes only safe download names', async () => {
  const { counts, problems } = await checkDownloadNames(repoRoot)
  assert.deepEqual(problems, [])
  // Every JSON file under downloads/ was read, and every kind of install was checked.
  assert.equal(counts.files, await countJsonFiles(path.join(repoRoot, 'downloads')))
  for (const kind of ['descriptors', 'indexEntries', 'collectionResources', 'packResources', 'catalogUrls', 'savedNames']) {
    assert.ok(counts[kind] > 0, `no ${kind} checked`)
  }
})

const APPS = 'https://apps.roachnet.org/downloads'
const KIWIX = 'https://download.kiwix.org/zim/other'
const sha = (text) => createHash('sha256').update(text).digest('hex')
const descriptor = (filename, extra = {}) => ({ schema: DESCRIPTOR_SCHEMA, filename, sources: [], parts: [], ...extra })
const source = (url, status = 'active', type = 'public-source') => ({ type, url, status })
const mapDescriptor = (filename, url, digest = 'a'.repeat(64), extra = {}) => descriptor(filename, { url, sha256: digest, bytes: 10, ...extra })
const chunked = (filename, part, digest) => descriptor(filename, {
  sha256: digest, bytes: 5, sources: [source('https://archive.org/details/i', 'published-after-upload', 'internet-archive-parts')], parts: [{ url: part, bytes: 5 }],
})
const direct = (id, filetype, url) => ({ id, installIntent: { action: 'direct-download', filetype, url } })
const speech = (id, intent) => ({ id, installIntent: { action: 'roachspeech-pack', kind: 'roachVoice', ...intent } })

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'download-names-'))
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(file), { recursive: true })
    if (content?.linkTo) await symlink(content.linkTo, file)
    else await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content))
  }
  return root
}

const empty = {
  'collections/maps.json': { collections: [] },
  'collections/kiwix-categories.json': { categories: [] },
  'collections/wikipedia.json': { options: [] },
  'collections/packs.json': { packs: [] },
  'app-store-catalog.json': { items: [] },
}

test('the World Atlas RoachNet 1.1 queues on its own must be in the catalog', async (t) => {
  const root = await fixture({ ...empty, 'downloads/maps/pmtiles/ohio_2026-10.json': mapDescriptor('ohio_2026-10.pmtiles', 'https://example.org/m/ohio_2026-10.pmtiles') })
  t.after(() => rm(root, { recursive: true, force: true }))
  const { problems } = await checkDownloadNames(root)
  assert.deepEqual(problems, [{ where: 'the World Atlas RoachNet 1.1 queues', problem: 'RoachNet looks for downloads/maps/pmtiles/global-min_2026-10.json, which this checkout doesn\'t have' }])
})

test('each unsafe name, shared name, missing checksum and unreadable file is reported, as RoachNet would resolve it', async (t) => {
  const themeZip = 'theme zip bytes'
  const root = await fixture({
    'downloads/broken.json': '{',
    'downloads/odd.json': [1, 2],
    'downloads/future.json': { schema: 'org.roachnet.apps.download-descriptor.v2', filename: 'x.zim' },
    // Never downloaded (no source), so they may share a name.
    'downloads/content/stacks/a/manifest.json': descriptor('manifest.bin'),
    'downloads/content/stacks/b/manifest.json': descriptor('manifest.bin'),
    'downloads/content/zim/fine_2026-01.json': descriptor('fine_2026-01.zim', { sources: [source(`${KIWIX}/fine_2026-01.zim`)] }),
    'downloads/content/zim/partial.json': descriptor('fine_2026-01.zim.part', { sources: [source(`${KIWIX}/x.zim`)] }),
    // RoachNet reaches this index through a resource named index.zim; it never looks at the schema.
    'downloads/content/zim/index.json': { schema: INDEX_SCHEMA, filename: '..', sources: [source(`${KIWIX}/index.zim`)], descriptors: [{ filename: 'ok.zim' }, { filename: 'pack/../x.zip' }] },
    'downloads/content/zim/wikipedia-selection.json': descriptor('Wikipedia-Selection.json', { sources: [source(`${KIWIX}/wikipedia-selection.zim`)] }),
    // One name and one address, but only one of them is checked.
    'downloads/content/zim/half-a.json': descriptor('half_2026-01.zim', { sha256: 'e'.repeat(64), sources: [source(`${KIWIX}/half_2026-01.zim`)] }),
    'downloads/content/zim/half-b.json': descriptor('half_2026-01.zim', { sources: [source(`${KIWIX}/half_2026-01.zim`)] }),
    'downloads/content/zim/nothing.json': descriptor('nothing_2026-01.zim'),
    'downloads/content/zim/addr.json': descriptor(undefined, { sources: [source('https://example.org/zim/.hidden.zim')] }),
    'downloads/model-packs/nosum.json': descriptor('nosum.zip', { bytes: 5, sources: [source('https://example.org/nosum.zip')] }),
    // No filename: RoachNet names the download after the address it downloads from.
    'downloads/content/zim/unnamed_2026-01.json': descriptor(undefined, { sources: [source(`${KIWIX}/unnamed_2026-01.zim`)] }),
    // Wikipedia options have descriptors of their own: this one gives the Kiwix book's name another source.
    'downloads/content/wikipedia/fine_2026-01.json': descriptor('fine_2026-01.zim', { sources: [source('https://mirror.example.org/zim/fine_2026-01.zim')] }),
    'downloads/content/wikipedia/other_2026-01.json': descriptor('other_2026-01.zim', { sources: [source(`${KIWIX}/other_2026-01.zim`)] }),
    'downloads/maps/pmtiles/global-min_2026-10.json': mapDescriptor('global-min_2026-10.pmtiles', 'https://example.org/m/global-min_2026-10.pmtiles'),
    'downloads/maps/pmtiles/ok_2026-10.json': mapDescriptor('ok_2026-10.pmtiles', 'https://example.org/m/ok_2026-10.pmtiles'),
    'downloads/maps/pmtiles/dots.json': mapDescriptor('..', 'https://example.org/m/x.pmtiles'),
    'downloads/maps/pmtiles/link.json': { linkTo: 'ok_2026-10.json' },
    'downloads/maps/pmtiles/nosum_2026-10.json': descriptor('nosum_2026-10.pmtiles', { url: 'https://example.org/m/nosum_2026-10.pmtiles' }),
    'downloads/maps/pmtiles/two_2026-10.json': mapDescriptor('two_2026-10.pmtiles', 'https://example.org/m/two_2026-10.pmtiles', 'c'.repeat(64)),
    'downloads/maps/pmtiles/case-lower.json': mapDescriptor('case_2026-10.pmtiles', 'https://example.org/e/case_2026-10.pmtiles'),
    'downloads/maps/pmtiles/case-upper.json': mapDescriptor('CASE_2026-10.pmtiles', 'https://example.org/f/CASE_2026-10.pmtiles'),
    // One url, but RoachNet downloads each one's first source.
    'downloads/maps/pmtiles/src-a.json': mapDescriptor('src_2026-10.pmtiles', 'https://example.org/m/src_2026-10.pmtiles', 'b'.repeat(64), { sources: [source('https://a.example.org/src_2026-10.pmtiles')] }),
    'downloads/maps/pmtiles/src-b.json': mapDescriptor('src_2026-10.pmtiles', 'https://example.org/m/src_2026-10.pmtiles', 'b'.repeat(64), { sources: [source('https://b.example.org/src_2026-10.pmtiles')] }),
    // One name and one address, but two checksums.
    'downloads/maps/pmtiles/sum-a.json': mapDescriptor('sum_2026-10.pmtiles', 'https://example.org/m/sum_2026-10.pmtiles', 'e'.repeat(64)),
    'downloads/maps/pmtiles/sum-b.json': mapDescriptor('sum_2026-10.pmtiles', 'https://example.org/m/sum_2026-10.pmtiles', 'f'.repeat(64)),
    // A pending mirror comes first, so RoachNet downloads the release: the file the copy names.
    'downloads/maps/pmtiles/pending_2026-10.json': mapDescriptor('pending_2026-10.pmtiles', null, 'a'.repeat(64), { sources: [source('https://archive.org/m/pending_2026-10.pmtiles', 'mirror-pending', 'internet-archive'), source('https://example.org/m/pending_2026-10.pmtiles')] }),
    'downloads/maps/pmtiles/pending-copy.json': mapDescriptor('pending_2026-10.pmtiles', 'https://example.org/m/pending_2026-10.pmtiles'),
    // Chunked: RoachNet downloads the parts each lists, so these are two different files.
    'downloads/model-packs/voice.json': chunked('voice.zip', 'https://archive.org/download/i/voice.zip.rnpart0001', sha('voice')),
    'downloads/model-packs/voice-copy.json': chunked('voice.zip', 'https://archive.org/download/i/voice-copy.zip.rnpart0001', sha('voice')),
    'downloads/packs/theme.zip': themeZip,
    'downloads/packs/theme2.zip': 'something else',
    'collections/maps.json': { collections: [{ slug: 'region', resources: [
      { id: 'ok', url: 'https://example.org/m/ok_2026-10.pmtiles', sha256: 'a'.repeat(64) },
      { id: 'stale', url: 'https://example.org/m/two_2026-10.pmtiles', sha256: 'd'.repeat(64) },
      { id: 'pending', url: 'https://example.org/m/pending_2026-10.pmtiles' },
      { id: 'withdrawn', url: 'https://example.org/m/gone_2026-10.pmtiles', unavailable: true },
      { id: 'nameless', url: 'https://example.org/' },
    ] }] },
    'collections/kiwix-categories.json': { categories: [{ slug: 'cat', tiers: [
      { slug: 'one', resources: [
        { id: 'fine', url: `${KIWIX}/fine_2026-01.zim` },
        { id: 'index', url: `${KIWIX}/index.zim` },
        { id: 'state', url: `${KIWIX}/wikipedia-selection.zim` },
        { id: 'missing', url: `${KIWIX}/gone_2026-01.zim` },
        { id: 'unnamed', url: `${KIWIX}/unnamed_2026-01.zim` },
      ] },
      // The same book from a mirror: the same descriptor, so the same file.
      { slug: 'two', resources: [{ id: 'fine', url: 'https://mirror.example.org/zim/fine_2026-01.zim' }] },
    ] }] },
    'collections/wikipedia.json': { options: [
      { id: 'none' },
      { id: 'other', url: `${KIWIX}/other_2026-01.zim` },
      { id: 'fine', url: 'https://mirror.example.org/zim/fine_2026-01.zim' },
    ] },
    'collections/packs.json': { packs: [
      { id: 'escape', resources: [{ path: '../escape.zip', url: `${APPS}/packs/missing.zip`, sha256: sha('x'), bytes: 1 }] },
      { id: 'theme', resources: [{ path: 'themes/theme.zip', url: `${APPS}/packs/theme.zip`, sha256: sha(themeZip), bytes: themeZip.length }] },
      { id: 'swapped', resources: [{ path: 'theme2.zip', url: `${APPS}/packs/theme2.zip`, sha256: sha(themeZip), bytes: themeZip.length }] },
      { id: 'voice', resources: [{ path: 'voice.zip', url: `${APPS}/model-packs/voice.json`, sha256: sha('voice'), bytes: 5 }] },
      { id: 'voice-stale', resources: [{ path: 'voice.zip', url: `${APPS}/model-packs/voice-copy.json`, sha256: sha('older'), bytes: 5 }] },
      { id: 'voice-size', resources: [{ path: 'voice.zip', url: `${APPS}/model-packs/voice.json`, sha256: sha('voice'), bytes: 6 }] },
      { id: 'solo', install: { handler: 'roachspeech-pack', kind: 'roachVoice' }, resources: [{ path: 'voice.zip', url: `${APPS}/model-packs/voice.json`, sha256: sha('voice'), bytes: 5 }] },
      { id: '.hidden-pack', install: { handler: 'roachspeech-pack' }, resources: [{ path: 'voice.zip', url: `${APPS}/model-packs/voice.json`, sha256: sha('voice'), bytes: 5 }] },
      { id: 'elsewhere', resources: [{ path: 'x.zip', url: 'https://cdn.example.org/x.zip', sha256: sha('x'), bytes: 1 }] },
    ] },
    'app-store-catalog.json': { items: [
      direct('ok', 'map', `${APPS}/maps/pmtiles/ok_2026-10.json`),
      direct('gone', 'map', `${APPS}/maps/pmtiles/gone.json`),
      direct('case-lower', 'pmtiles', `${APPS}/maps/pmtiles/case-lower.json`),
      direct('case-upper', 'map', `${APPS}/maps/pmtiles/case-upper.json`),
      direct('src-a', 'map', `${APPS}/maps/pmtiles/src-a.json`),
      direct('src-b', 'map', `${APPS}/maps/pmtiles/src-b.json`),
      direct('pending-copy', 'map', `${APPS}/maps/pmtiles/pending-copy.json`),
      direct('sum-a', 'map', `${APPS}/maps/pmtiles/sum-a.json`),
      direct('sum-b', 'map', `${APPS}/maps/pmtiles/sum-b.json`),
      direct('zim', 'zim', `${APPS}/content/zim/fine_2026-01.json`),
      direct('raw', 'knowledge', `${KIWIX}/raw_2026-01.zim`),
      direct('exe', 'exe', `${APPS}/maps/pmtiles/ok_2026-10.json`),
      direct('partial-url', 'zim', 'https://example.org/x/x.zim.part'),
      direct('evil', 'zim', 'https://example.org/evil.json'),
      direct('port', 'map', 'https://apps.roachnet.org:8443/downloads/maps/pmtiles/port_2026-10.json'),
      direct('half-a', 'zim', `${APPS}/content/zim/half-a.json`),
      direct('half-b', 'zim', `${APPS}/content/zim/half-b.json`),
      direct('nothing', 'zim', `${APPS}/content/zim/nothing.json`),
      direct('addr', 'zim', `${APPS}/content/zim/addr.json`),
      speech('voice', { pack: 'voice-pack', url: `${APPS}/model-packs/voice.json` }),
      speech('voice-dup', { pack: 'voice-pack', url: `${APPS}/model-packs/voice-copy.json` }),
      speech('bad-pack', { pack: '..', url: `${APPS}/model-packs/voice.json` }),
      speech('bad-kind', { pack: 'kind-pack', kind: '..', url: `${APPS}/model-packs/voice.json` }),
      speech('mixed', { pack: 'fine-pack', packID: '..', url: `${APPS}/model-packs/voice.json` }),
      speech('differ', { pack: 'a-pack', packID: 'b-pack', url: `${APPS}/model-packs/voice.json` }),
      // Folders that differ only in case are one folder on a Mac.
      speech('case-pack-1', { pack: 'Case-Pack', url: `${APPS}/model-packs/voice.json` }),
      speech('case-pack-2', { pack: 'case-pack', url: `${APPS}/model-packs/voice-copy.json` }),
      // The packs.json speech pack "solo" downloads into the same folder.
      speech('solo', { pack: 'solo', url: `${APPS}/model-packs/voice-copy.json` }),
      { id: 'alias', installIntent: { action: 'roachvoice-pack', kind: 'roachVoice', pack: '.hidden', url: `${APPS}/model-packs/voice.json` } },
    ] },
  })
  t.after(() => rm(root, { recursive: true, force: true }))

  const { problems } = await checkDownloadNames(root)
  const listed = problems.map(({ where, problem }) => `${where}: ${problem}`).join('\n')
  const expected = [
    [['downloads/broken.json'], 'is not valid JSON'],
    [['downloads/odd.json'], 'is not a JSON object'],
    [['downloads/future.json'], 'which this check doesn\'t know'],
    [['downloads/content/zim/partial.json'], '".part"'],
    [['downloads/content/zim/unnamed_2026-01.json'], 'filename null is missing'],
    [['downloads/content/zim/addr.json'], 'filename null is missing'],
    [['downloads/model-packs/nosum.json'], 'no SHA-256'],
    [['downloads/maps/pmtiles/nosum_2026-10.json'], 'has no size'],
    [['downloads/content/zim/index.json'], 'filename ".." is made only of dots'],
    [['downloads/content/zim/index.json › descriptors[1]'], 'path separator'],
    [['downloads/maps/pmtiles/dots.json'], 'made only of dots'],
    [['downloads/maps/pmtiles/link.json'], 'is a link'],
    [['downloads/maps/pmtiles/nosum_2026-10.json'], 'no SHA-256'],
    [['collections/maps.json › region › stale'], 'but downloads/maps/pmtiles/two_2026-10.json has cccccccccccc'],
    [['collections/maps.json › region › nameless'], 'names no file'],
    [['collections/kiwix-categories.json › cat › one › state'], 'a file RoachNet keeps there itself'],
    [['collections/kiwix-categories.json › cat › one › missing'], 'downloads/content/zim/gone_2026-01.json'],
    [['collections/packs.json › escape'], 'part ".."'],
    [['collections/packs.json › escape'], 'downloads/packs/missing.zip'],
    [['collections/packs.json › swapped'], 'but downloads/packs/theme2.zip is'],
    [['collections/packs.json › voice-stale'], 'but downloads/model-packs/voice-copy.json has'],
    [['app-store-catalog.json › gone'], 'downloads/maps/pmtiles/gone.json'],
    [['app-store-catalog.json › exe'], 'file type "exe"'],
    [['app-store-catalog.json › bad-pack'], 'pack ".."'],
    [['app-store-catalog.json › bad-kind'], 'pack kind ".."'],
    [['app-store-catalog.json › mixed'], 'packID ".."'],
    [['app-store-catalog.json › mixed'], 'differ, so the Mac app'],
    [['app-store-catalog.json › differ'], 'differ, so the Mac app'],
    [['app-store-catalog.json › alias'], 'pack ".hidden"'],
    [['app-store-catalog.json › partial-url'], 'URL name "x.zim.part"'],
    [['app-store-catalog.json › evil'], 'which RoachNet 1.0.6 would open as a descriptor'],
    [['app-store-catalog.json › port'], 'which RoachNet 1.0.6 would open as a descriptor'],
    [['app-store-catalog.json › nothing'], 'names nothing RoachNet can download'],
    [['app-store-catalog.json › addr'], 'has no filename, and the name from its address ".hidden.zim"'],
    [['collections/packs.json › voice-size'], '6 bytes, but downloads/model-packs/voice.json has'],
    [['collections/packs.json › .hidden-pack'], 'pack id ".hidden-pack"'],
    // A missing checksum is a different checksum.
    [['app-store-catalog.json › half-a', 'app-store-catalog.json › half-b'], 'zim/half_2026-01.zim'],
    [['app-store-catalog.json › case-pack-1', 'app-store-catalog.json › case-pack-2'], 'roachVoice/Case-Pack/voice.zip'],
    [['collections/packs.json › solo', 'app-store-catalog.json › solo'], 'roachVoice/solo/voice.zip'],
    // Names that differ only in case are one file on a Mac.
    [['app-store-catalog.json › case-lower', 'app-store-catalog.json › case-upper'], 'maps/pmtiles/case_2026-10.pmtiles'],
    [['app-store-catalog.json › src-a', 'app-store-catalog.json › src-b'], 'maps/pmtiles/src_2026-10.pmtiles'],
    [['app-store-catalog.json › sum-a', 'app-store-catalog.json › sum-b'], 'maps/pmtiles/sum_2026-10.pmtiles'],
    [['collections/kiwix-categories.json › cat › one › fine', 'collections/wikipedia.json › fine'], 'zim/fine_2026-01.zim'],
    [['app-store-catalog.json › voice', 'app-store-catalog.json › voice-dup'], 'roachVoice/voice-pack/voice.zip'],
  ]
  for (const [places, text] of expected) {
    assert.ok(problems.some(({ where, problem }) => places.every((place) => where.includes(place)) && problem.includes(text)), `not reported: ${places.join(', ')}: ${text}\n${listed}`)
  }
  assert.equal(problems.length, expected.length, listed)
  // Names never downloaded, one file reached from several places, a pending
  // mirror, a withdrawn resource and a pack hosted elsewhere are all fine.
  assert.doesNotMatch(listed, /manifest|ok_2026-10|other_2026-01|pending|raw_2026-01|withdrawn|global-min|elsewhere|› theme:/)
})
