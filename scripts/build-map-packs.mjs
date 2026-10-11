// Regenerates the map side of apps.roachnet.org from collections/map-packs-2026-10.json
// (the inventory of the RoachWares/RoachNet-Maps `maps-2026-10` release):
//
//   collections/maps.json                    regional collections for RoachNet 1.1+ (live collections)
//   downloads/maps/pmtiles/<name>.json       one descriptor per published pack
//   downloads/maps/pmtiles/<old>_2025-12.json  aliases so RoachNet 1.0.6, which ships its own
//                                            2025-12 collection list, resolves every state to the
//                                            new file (saved under the name 1.0.6 looks for)
//
// Run: node scripts/build-map-packs.mjs   (then npm run build:catalog)
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(path.join(repoRoot, 'collections/map-packs-2026-10.json'), 'utf8'))
const mapsPath = path.join(repoRoot, 'collections/maps.json')
const maps = JSON.parse(await readFile(mapsPath, 'utf8'))
const descriptorDir = path.join(repoRoot, 'downloads/maps/pmtiles')
const descriptorBase = 'https://apps.roachnet.org/downloads/maps/pmtiles'
const policy =
  'Apps.RoachNet.org hosts descriptors and checksums. The map files are release assets on github.com/RoachWares/RoachNet-Maps; RoachNet checks the SHA-256 below after every download.'

const bySlug = new Map(data.packs.map((pack) => [pack.slug, pack]))
const assetUrl = (pack) => `${data.assetBaseUrl}/${pack.file}`
const sizeLabel = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`)
const isTerritory = (pack) => ['PR', 'VI', 'GU', 'AS', 'MP'].includes(pack.code)
const kindOf = (pack) =>
  pack.slug === 'global-min' ? 'world' : pack.code === 'DC' ? 'district' : isTerritory(pack) ? 'territory' : 'state'

function describe(pack) {
  if (pack.slug === 'global-min') return 'The whole world at zoom 0–7: coastlines, countries, major roads and cities.'
  const what = { district: 'the District of Columbia', territory: pack.name, state: `the state of ${pack.name}` }[kindOf(pack)]
  return `Street-level offline map of ${what}, clipped to its real boundary.`
}

function sourceList(pack) {
  return [
    {
      type: 'github-release',
      label: `RoachNet Maps ${data.release} release`,
      url: assetUrl(pack),
      status: 'active',
    },
  ]
}

function descriptor(pack, { filename, id, title, section, alias = false }) {
  const name = filename.replace(/\.pmtiles$/, '')
  return {
    schema: 'org.roachnet.apps.download-descriptor.v1',
    id,
    title,
    category: 'Maps',
    section,
    action: 'direct-download',
    kind: 'pmtiles',
    tier: null,
    filename,
    key: `maps/pmtiles/${filename}`,
    descriptorUrl: `${descriptorBase}/${name}.json`,
    bytes: pack.bytes,
    size: sizeLabel(pack.bytes),
    sha256: pack.sha256,
    chunkSizeBytes: null,
    parts: [],
    sources: sourceList(pack),
    url: assetUrl(pack),
    checksumUrl: null,
    build: data.build,
    zoom: { min: pack.minzoom, max: pack.maxzoom },
    bounds: pack.bounds,
    attribution: data.attribution,
    ...(alias
      ? {
          aliasOf: pack.file,
          note: `RoachNet 1.0.6 asks for ${filename}. This serves the ${data.release} pack (${pack.file}) under that name so 1.0.6 can install it and see it as installed.`,
        }
      : {}),
    status: 'published',
    policy,
  }
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`
await mkdir(descriptorDir, { recursive: true })
let written = 0

// 1. Descriptors for every published pack.
for (const pack of data.packs) {
  await writeFile(
    path.join(descriptorDir, pack.file.replace(/\.pmtiles$/, '.json')),
    json(descriptor(pack, { filename: pack.file, id: `map-${pack.slug.replace(/_/g, '-')}`, title: pack.name, section: 'Map Packs' })),
  )
  written += 1
}

// 2. 1.0.6 aliases: every state 1.0.6 bundles, plus the old Global Mini Atlas pick.
// 1.0.6 bundles the 50 states (no DC, no territories) as <slug>_2025-12.pmtiles.
const legacy = [...data.packs.filter((pack) => kindOf(pack) === 'state').map((pack) => pack.slug), 'global-min']
let aliases = 0
for (const slug of new Set(legacy)) {
  const pack = bySlug.get(slug)
  if (!pack) throw new Error(`No ${data.release} pack for 1.0.6 resource ${slug}`)
  const filename = `${slug}_2025-12.pmtiles`
  await writeFile(
    path.join(descriptorDir, `${slug}_2025-12.json`),
    json(descriptor(pack, { filename, id: `map-${slug.replace(/_/g, '-')}-legacy`, title: pack.name, section: 'Map Packs', alias: true })),
  )
  aliases += 1
}

// 3. Collections for 1.1+: same nine regions (plus DC in South Atlantic) and a territories shelf.
const resourceFor = (pack) => ({
  id: pack.slug,
  version: data.release.replace(/^maps-/, ''),
  title: pack.name,
  description: describe(pack),
  url: assetUrl(pack),
  size_mb: Math.max(1, Math.round(pack.bytes / 1e6)),
  sha256: pack.sha256,
})
const regionWords = (resources) => {
  const names = resources.map((resource) => resource.title)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
}

const collections = maps.collections.filter((collection) => collection.slug !== 'us-territories').map((collection) => {
  const slugs = collection.resources.map((resource) => resource.id)
  if (collection.slug === 'south-atlantic' && !slugs.includes('district_of_columbia')) slugs.splice(1, 0, 'district_of_columbia')
  const resources = slugs.map((slug) => resourceFor(bySlug.get(slug)))
  return {
    ...collection,
    description: `Street-level offline maps of ${regionWords(resources)}.`,
    resources,
  }
})
const territories = data.packs.filter(isTerritory)
collections.push({
  name: 'US Territories',
  slug: 'us-territories',
  description: `Street-level offline maps of ${regionWords(territories.map(resourceFor))}.`,
  icon: 'IconMap',
  language: 'en',
  minimumRoachNet: '1.1.0',
  resources: territories.map(resourceFor),
})
const covered = new Set(collections.flatMap((collection) => collection.resources.map((resource) => resource.id)))
const missing = data.packs.filter((pack) => pack.slug !== 'global-min' && !covered.has(pack.slug)).map((pack) => pack.slug)
if (missing.length) throw new Error(`Packs not in any collection: ${missing.join(', ')}`)

await writeFile(
  mapsPath,
  json({
    spec_version: '2026-10-11',
    release: data.release,
    source: `https://github.com/${data.repo}/releases/tag/${data.release}`,
    attribution: data.attribution,
    collections,
  }),
)

console.log(`map packs: ${written} descriptors, ${aliases} 1.0.6 aliases, ${collections.length} collections`)
