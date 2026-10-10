#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const sourceRoot =
  process.env.ROACHNET_ROACHSPEECH_PACKS_DIR ||
  path.resolve(repoRoot, '../RoachNet/native/macos/dist/RoachSpeechPacks')

const appsBaseUrl = process.env.ROACHNET_APPS_BASE_URL || 'https://apps.roachnet.org'
const archiveIdentifier = process.env.ROACHNET_ARCHIVE_IDENTIFIER || 'roachnet-apps-catalog-v1_0_5'
const defaultIaChunkSizeBytes = 8 * 1024 * 1024
const iaChunkSizeBytes = Number(process.env.ROACHNET_IA_CHUNK_BYTES || defaultIaChunkSizeBytes)
const iaPartsStatus = process.env.ROACHNET_IA_PARTS_STATUS || 'upload-required'
const downloadsRoot = path.join(repoRoot, 'downloads')
const modelPackRoot = path.join(downloadsRoot, 'model-packs')
const storageRoot = path.join(repoRoot, 'storage')
const catalogPath = path.join(repoRoot, 'app-store-catalog.json')

const localPackFiles = new Map([
  ['roachvoice-chatterbox-coreml.zip', { id: 'roachvoice-chatterbox-coreml', kind: 'roachVoice', tier: 'voice-clone' }],
  ['roachvoice-kokoro-82m-int8-coreml.zip', { id: 'roachvoice-kokoro-82m-int8-coreml', kind: 'roachVoice', tier: 'small-narrator' }],
  ['roachwhisper-openai-whisper-base-en-coreml.zip', { id: 'roachwhisper-openai-whisper-base-en-coreml', kind: 'roachWhisper', tier: 'speech-to-text' }],
])

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${bytes} B`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function archiveUrl(key) {
  return `https://archive.org/download/${archiveIdentifier}/${iaObjectName(key)}`
}

function iaObjectName(key) {
  return key.split('/').join('__')
}

function partObjectName(archiveKey, partNumber, partCount) {
  const width = Math.max(4, String(partCount).length)
  return `${iaObjectName(archiveKey)}.rnpart${String(partNumber).padStart(width, '0')}`
}

function chunkHeader(partIndex, payloadBytes, payloadSha256) {
  return `ROACHNET-IA-CHUNK-v1 ${partIndex} ${payloadBytes} ${payloadSha256}\n`
}

async function chunkManifestForFile(filePath, archiveKey, bytes) {
  if (!Number.isSafeInteger(iaChunkSizeBytes) || iaChunkSizeBytes <= 0) {
    throw new Error(`ROACHNET_IA_CHUNK_BYTES must be a positive integer. Received ${process.env.ROACHNET_IA_CHUNK_BYTES}.`)
  }

  const partCount = Math.max(1, Math.ceil(bytes / iaChunkSizeBytes))
  const parts = []
  let index = 0
  let offset = 0
  let partBytes = 0
  let hash = createHash('sha256')

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: Math.min(iaChunkSizeBytes, 1024 * 1024) })
    stream.on('error', reject)
    stream.on('data', (chunk) => {
      let cursor = 0
      while (cursor < chunk.length) {
        const remainingForPart = iaChunkSizeBytes - partBytes
        const sliceLength = Math.min(remainingForPart, chunk.length - cursor)
        const slice = chunk.subarray(cursor, cursor + sliceLength)
        hash.update(slice)
        partBytes += sliceLength
        cursor += sliceLength

        if (partBytes === iaChunkSizeBytes) {
          index += 1
          const key = partObjectName(archiveKey, index, partCount)
          const sha256 = hash.digest('hex')
          const header = chunkHeader(index - 1, partBytes, sha256)
          parts.push({
            index: index - 1,
            key,
            url: archiveUrl(key),
            offset,
            bytes: partBytes,
            sha256,
            encoding: 'roachnet-ia-chunk-v1',
            header,
            encodedBytes: Buffer.byteLength(header) + partBytes,
          })
          offset += partBytes
          partBytes = 0
          hash = createHash('sha256')
        }
      }
    })
    stream.on('end', resolve)
  })

  if (partBytes > 0 || parts.length === 0) {
    index += 1
    const key = partObjectName(archiveKey, index, partCount)
    const sha256 = hash.digest('hex')
    const header = chunkHeader(index - 1, partBytes, sha256)
    parts.push({
      index: index - 1,
      key,
      url: archiveUrl(key),
      offset,
      bytes: partBytes,
      sha256,
      encoding: 'roachnet-ia-chunk-v1',
      header,
      encodedBytes: Buffer.byteLength(header) + partBytes,
    })
  }

  return parts
}

function sourceFilename(sourceUrl, fallback) {
  try {
    return path.basename(new URL(sourceUrl).pathname) || fallback
  } catch {
    return fallback
  }
}

function descriptorKeyForItem(item) {
  const artifactUrl = item.artifact?.url
  if (artifactUrl?.startsWith(`${appsBaseUrl}/downloads/`)) {
    return artifactUrl.slice(`${appsBaseUrl}/downloads/`.length)
  }
  return item.artifact?.key || `catalog/${item.id}.json`
}

function archiveKeyForItem(item, descriptorKey) {
  if (item.installIntent?.artifactKey) return item.installIntent.artifactKey
  const sourceUrl = item.artifact?.sourceUrl || item.installIntent?.url
  const filename = sourceFilename(sourceUrl, path.basename(descriptorKey).replace(/\.json$/i, '.bin'))
  const directory = path.dirname(descriptorKey)
  return directory === '.' ? filename : path.join(directory, filename)
}

function descriptorTitle(item) {
  return item.title || item.id
}

async function fileInfoForArchiveKey(archiveKey) {
  const filename = path.basename(archiveKey)
  const localPack = localPackFiles.get(filename)
  if (!localPack) return null

  const filePath = path.join(sourceRoot, filename)
  const info = await stat(filePath)
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Expected a non-empty model-pack file: ${filePath}`)
  }
  const raw = await readFile(`${filePath}.sha256`, 'utf8')
  const checksum = raw.trim().split(/\s+/)[0]
  if (!/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new Error(`Expected a sha256 digest in ${filePath}.sha256`)
  }
  return {
    ...localPack,
    filePath,
    bytes: info.size,
    sha256: checksum.toLowerCase(),
  }
}

async function descriptorForItem(item) {
  if (!item.artifact?.url) return null
  if (item.artifact.status === 'runtime-pull') return null

  const descriptorKey = descriptorKeyForItem(item)
  const archiveKey = archiveKeyForItem(item, descriptorKey)
  const filename = path.basename(archiveKey)
  const localInfo = await fileInfoForArchiveKey(archiveKey)
  const originalSource = item.artifact.sourceUrl || item.installIntent?.url || null
  const hasLocalArchive = Boolean(localInfo)
  const parts = localInfo ? await chunkManifestForFile(localInfo.filePath, archiveKey, localInfo.bytes) : []

  const sources = []
  if (hasLocalArchive) {
    sources.push({
      type: 'internet-archive-parts',
      label: 'Internet Archive chunked public item',
      url: `https://archive.org/details/${archiveIdentifier}`,
      partCount: parts.length,
      partSize: iaChunkSizeBytes,
      status: iaPartsStatus,
    })
    sources.push({
      type: 'internet-archive',
      label: 'Internet Archive single-object fallback',
      url: archiveUrl(archiveKey),
      status: 'single-object-pending',
    })
  } else if (originalSource) {
    sources.push({
      type: 'public-source',
      label: 'Original public source',
      url: originalSource,
      status: 'active',
    })
    sources.push({
      type: 'internet-archive',
      label: 'RoachNet Internet Archive mirror',
      url: archiveUrl(archiveKey),
      status: 'mirror-pending',
    })
  }

  return {
    schema: 'org.roachnet.apps.download-descriptor.v1',
    id: item.id,
    title: descriptorTitle(item),
    category: item.category || null,
    section: item.section || null,
    action: item.installIntent?.action || null,
    kind: localInfo?.kind || item.installIntent?.kind || null,
    tier: localInfo?.tier || null,
    filename,
    key: archiveKey,
    internetArchiveKey: iaObjectName(archiveKey),
    descriptorUrl: `${appsBaseUrl}/downloads/${descriptorKey}`,
    bytes: localInfo?.bytes || null,
    size: formatBytes(localInfo?.bytes) || item.size || null,
    sha256: localInfo?.sha256 || null,
    chunkSizeBytes: parts.length ? iaChunkSizeBytes : null,
    parts,
    sources,
    checksumUrl: localInfo?.sha256 ? `${appsBaseUrl}/downloads/${archiveKey}.sha256` : null,
    status: hasLocalArchive && iaPartsStatus === 'published-after-upload'
      ? 'descriptor-ready-chunked-source-live'
      : hasLocalArchive
        ? 'descriptor-ready-ia-upload-required'
        : 'descriptor-ready-public-source-first',
    policy:
      'Apps.RoachNet.org hosts descriptors and checksums. Large archives live on public source rails and Internet Archive mirrors, not this machine, Netlify, GitHub source, or R2.',
  }
}

async function writeDescriptor(descriptor) {
  const targetPath = path.join(downloadsRoot, descriptor.descriptorUrl.slice(`${appsBaseUrl}/downloads/`.length))
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(descriptor, null, 2)}\n`)

  if (descriptor.sha256) {
    const checksumPath = path.join(downloadsRoot, `${descriptor.key}.sha256`)
    await mkdir(path.dirname(checksumPath), { recursive: true })
    await writeFile(checksumPath, `${descriptor.sha256}  ${descriptor.filename}\n`)
  }
}

async function main() {
  await mkdir(modelPackRoot, { recursive: true })
  await mkdir(storageRoot, { recursive: true })

  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const descriptors = []
  // ROACHNET_STAGE_SKIP_MODEL_PACKS=1 regenerates only the content descriptors
  // (ZIM, Wikipedia, maps) and leaves the published model-pack descriptors —
  // whose digests and Internet Archive parts are already live — untouched.
  const skipModelPacks = process.env.ROACHNET_STAGE_SKIP_MODEL_PACKS === '1'
  for (const item of catalog.items || []) {
    if (skipModelPacks && descriptorKeyForItem(item).startsWith('model-packs/')) continue
    const descriptor = await descriptorForItem(item)
    if (!descriptor) continue
    descriptors.push(descriptor)
    await writeDescriptor(descriptor)
  }

  const totalBytes = descriptors.reduce((sum, descriptor) => sum + (descriptor.bytes || 0), 0)
  const staticArchives = descriptors.filter((descriptor) => descriptor.sources.some((source) => source.type === 'internet-archive'))
  const localArchives = descriptors.filter((descriptor) => descriptor.sha256)
  const chunkedArchives = localArchives.filter((descriptor) => Array.isArray(descriptor.parts) && descriptor.parts.length > 0)
  const totalParts = chunkedArchives.reduce((sum, descriptor) => sum + descriptor.parts.length, 0)
  const manifest = {
    schema: 'org.roachnet.apps.download-index.v1',
    generatedAt: new Date().toISOString(),
    host: appsBaseUrl,
    archiveIdentifier,
    storage: 'same-origin descriptors with Internet Archive mirror targets and public source fallback URLs',
    descriptorCount: descriptors.length,
    localArchiveCount: localArchives.length,
    chunkedArchiveCount: chunkedArchives.length,
    partCount: totalParts,
    chunkSizeBytes: iaChunkSizeBytes,
    internetArchiveTargetCount: staticArchives.length,
    totalBytes,
    totalSize: formatBytes(totalBytes),
    policy:
      'The App Store page owns the install contract. Downloads resolve through descriptors, public sources, and Internet Archive mirrors instead of a private host.',
    descriptors,
  }

  if (!skipModelPacks) {
    await writeFile(path.join(modelPackRoot, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  await writeFile(path.join(storageRoot, 'apps-download-descriptors.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Indexed ${descriptors.length} Apps descriptors.`)
  console.log(`Local first-party archives ready for IA upload: ${localArchives.length} (${formatBytes(totalBytes) || 'unknown total'}).`)
  console.log('No binary archives copied into the site.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
