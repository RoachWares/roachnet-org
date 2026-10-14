import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { checkDownloadNames, DESCRIPTOR_SCHEMA, downloadNameProblem, INDEX_SCHEMA, MAX_NAME_LENGTH } from '../scripts/download-names.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
  'x\u0000.zim', 'x\n.zim', 'x\t.zim',
  ' x.zim', 'x.zim ', 'x y.zim', 'caf\u00e9.zim', 'cafe\u0301.zim', 'x\u200b.zim', '%2e%2e', 'x:y.zim',
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
  assert.match(downloadNameProblem('x\u0000.zim'), /control character/)
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
  const alphabet = ['a', 'Z', '0', '.', '-', '_', ' ', '/', '\\', '\u0000', '\u00e9', '%', 'p']
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
  // Every JSON file under downloads/ was read, and every kind of source was checked.
  assert.equal(counts.files, await countJsonFiles(path.join(repoRoot, 'downloads')))
  for (const kind of ['descriptors', 'indexEntries', 'collectionResources', 'packResources', 'catalogUrls', 'savedNames']) {
    assert.ok(counts[kind] > 0, `no ${kind} checked`)
  }
})

const descriptor = (filename, extra = {}) => ({ schema: DESCRIPTOR_SCHEMA, id: filename, action: 'direct-download', kind: 'pmtiles', filename, sources: [], parts: [], ...extra })

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

test('unsafe names, names two downloads share, and files the check can\'t read are each reported', async (t) => {
  const kiwix = 'https://download.kiwix.org/zim/other'
  const root = await fixture({
    'downloads/broken.json': '{',
    'downloads/future.json': { schema: 'org.roachnet.apps.download-descriptor.v2', filename: 'x.zim' },
    'downloads/content/stacks/manifest-a.json': descriptor('manifest.bin', { action: 'education-tier', kind: null }),
    'downloads/content/stacks/manifest-b.json': descriptor('manifest.bin', { action: 'education-tier', kind: null }),
    'downloads/content/zim/partial.json': descriptor('fine_2026-01.zim.part', { action: 'education-resource', kind: null, sources: [{ type: 'public-source', url: `${kiwix}/fine_2026-01.zim` }] }),
    'downloads/maps/pmtiles/ok_2026-10.json': descriptor('ok_2026-10.pmtiles', { url: 'https://example.org/a/ok_2026-10.pmtiles', sha256: 'a'.repeat(64) }),
    'downloads/maps/pmtiles/dots.json': descriptor('..', { url: 'https://example.org/a/x.pmtiles' }),
    'downloads/maps/pmtiles/link.json': { linkTo: 'ok_2026-10.json' },
    'downloads/maps/pmtiles/case-lower.json': descriptor('case_2026-10.pmtiles', { url: 'https://example.org/e/case_2026-10.pmtiles' }),
    'downloads/maps/pmtiles/case-upper.json': descriptor('CASE_2026-10.pmtiles', { url: 'https://example.org/f/CASE_2026-10.pmtiles' }),
    'downloads/maps/pmtiles/two.json': descriptor('two_2026-10.pmtiles', { url: 'https://example.org/c/two_2026-10.pmtiles', sha256: 'c'.repeat(64) }),
    'downloads/model-packs/index.json': { schema: INDEX_SCHEMA, descriptors: [{ filename: 'pack.zip' }, { filename: 'pack/../x.zip' }] },
    'collections/maps.json': { collections: [{ slug: 'region', resources: [
      { id: 'ok', url: 'https://example.org/a/ok_2026-10.pmtiles', sha256: 'a'.repeat(64) },
      { id: 'stale', url: 'https://example.org/c/two_2026-10.pmtiles', sha256: 'd'.repeat(64) },
      { id: 'encoded', url: 'https://example.org/maps/..%2F..%2Fx.pmtiles' },
    ] }] },
    'collections/kiwix-categories.json': { categories: [{ slug: 'cat', tiers: [{ slug: 'tier', resources: [
      { id: 'fine', url: `${kiwix}/fine_2026-01.zim` },
      { id: 'other', url: `${kiwix}/other_2026-01.zim` },
      { id: 'hidden', url: `${kiwix}/.hidden.zim` },
    ] }] }] },
    'collections/wikipedia.json': { options: [
      { id: 'none' },
      { id: 'same', url: `${kiwix}/other_2026-01.zim` },
      { id: 'mirror', url: 'https://mirror.example.org/zim/fine_2026-01.zim' },
    ] },
    'collections/packs.json': { packs: [{ id: 'theme', resources: [{ path: '../escape.zip', url: 'https://apps.roachnet.org/downloads/packs/missing.zip' }] }] },
    'app-store-catalog.json': { items: [
      { id: 'ok', installIntent: { action: 'direct-download', filetype: 'pmtiles', url: 'https://apps.roachnet.org/downloads/maps/pmtiles/ok_2026-10.json' } },
      { id: 'gone', installIntent: { action: 'direct-download', filetype: 'pmtiles', url: 'https://apps.roachnet.org/downloads/maps/pmtiles/gone.json' } },
    ] },
  })
  t.after(() => rm(root, { recursive: true, force: true }))

  const { problems } = await checkDownloadNames(root)
  const listed = problems.map(({ where, problem }) => `${where}: ${problem}`).join('\n')
  const expected = [
    [['downloads/broken.json'], 'is not valid JSON'],
    [['downloads/future.json'], 'which this check doesn\'t know'],
    [['downloads/content/zim/partial.json'], '".part"'],
    [['downloads/maps/pmtiles/dots.json'], 'made only of dots'],
    [['downloads/maps/pmtiles/link.json'], 'is a link'],
    [['downloads/model-packs/index.json › descriptors[1]'], 'path separator'],
    [['collections/maps.json › region › encoded'], 'character RoachNet replaces'],
    [['collections/kiwix-categories.json › cat › tier › hidden'], 'hidden file'],
    [['collections/packs.json › theme'], 'resource path "../escape.zip"'],
    [['collections/packs.json › theme'], 'downloads/packs/missing.zip'],
    [['app-store-catalog.json › gone'], 'downloads/maps/pmtiles/gone.json'],
    // Names that differ only in case are one file on a Mac.
    [['downloads/maps/pmtiles/case-lower.json', 'downloads/maps/pmtiles/case-upper.json'], 'maps/pmtiles/case_2026-10.pmtiles'],
    // One name, one address, two checksums.
    [['downloads/maps/pmtiles/two.json', 'collections/maps.json › region › stale'], 'maps/pmtiles/two_2026-10.pmtiles'],
    // One name from two addresses.
    [['collections/kiwix-categories.json › cat › tier › fine', 'collections/wikipedia.json › mirror'], 'zim/fine_2026-01.zim'],
  ]
  for (const [places, text] of expected) {
    assert.ok(problems.some(({ where, problem }) => places.every((place) => where.includes(place)) && problem.includes(text)), `not reported: ${places.join(', ')}: ${text}\n${listed}`)
  }
  assert.equal(problems.length, expected.length, listed)
  // A name shared only by descriptors RoachNet never downloads, and one name
  // reached from several places at one address, are fine.
  assert.doesNotMatch(listed, /manifest|ok_2026-10|other_2026-01/)
})
