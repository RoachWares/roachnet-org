#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arguments_ = process.argv.slice(2)
const reconcile = arguments_.includes('--reconcile')
const write = arguments_.includes('--write')
const verify = arguments_.includes('--verify')
const outputIndex = arguments_.indexOf('--output-dir')
const outputDirectory = outputIndex === -1 ? root : path.resolve(arguments_[outputIndex + 1] || '')
const allowed = new Set(['--reconcile', '--verify', '--write', '--output-dir'])
if ((!reconcile && !verify && !write) || arguments_.some((argument, index) => !allowed.has(argument) && arguments_[index - 1] !== '--output-dir') || (outputIndex !== -1 && !arguments_[outputIndex + 1])) {
  throw new Error('Usage: node scripts/tangle.mjs --verify [--write] [--output-dir directory] | --reconcile')
}

function safePath(value) {
  if (!value || path.isAbsolute(value) || value.includes('\\')) {
    throw new Error(`Unsafe chunk path: ${value || '(empty)'}`)
  }
  const resolved = path.resolve(root, value)
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Chunk path escapes repository: ${value}`)
  }
  return resolved
}

function parse(document) {
  const chunks = new Map()
  const targets = new Set()
  const matcher = /(^|\n)```[^\n]*\{chunk="([A-Za-z0-9_-]+)"(?: file="([^"]+)")?\}\n([\s\S]*?)```(?=\n|$)/g
  let match
  while ((match = matcher.exec(document))) {
    const [, , name, target, content] = match
    if (chunks.has(name)) throw new Error(`Duplicate chunk: ${name}`)
    if (target && targets.has(target)) throw new Error(`Duplicate root: ${target}`)
    if (target) targets.add(target)
    chunks.set(name, { target, content })
  }
  if (!chunks.size) throw new Error('No chunks found')
  return chunks
}

function expand(name, chunks, stack = []) {
  if (stack.includes(name)) throw new Error(`Chunk cycle: ${[...stack, name].join(' -> ')}`)
  const chunk = chunks.get(name)
  if (!chunk) throw new Error(`Missing chunk: ${name}`)
  return chunk.content.replace(/<<([A-Za-z0-9_-]+)>>/g, (_, reference) => expand(reference, chunks, [...stack, name]))
}

const sourceFiles = [
  '404.html', 'account.js', 'account/index.html', 'api.js', 'api/index.html', 'app-store.html', 'app-store.js', 'brew/index.html', 'home/index.html', 'html-validate.json', 'index.html', 'ios/index.html', 'landing-script.js', 'landing-dither.js', 'netlify.toml',
  'nx.css', 'nx.js', 'nx-halloween.js', 'nx-halloween.css', 'nx-account.css', 'nx-docs.css', 'nx-mission.css', 'nx-store.css', 'package-lock.json', 'package.json', 'roachclaw-web.css', 'roachclaw.js', 'roachclaw/index.html', 'robots-accounts.txt', 'robots-apps.txt', 'site-account.js', 'sitemap/index.html',
  'scripts/build-accounts-site.mjs', 'scripts/build-apps-site.mjs', 'scripts/build-main-site.mjs', 'scripts/check-links.mjs',
  'scripts/site-browser-outcomes.mjs', 'scripts/snapshot-live-sites.mjs', 'scripts/tangle.mjs', 'scripts/validate-html.mjs',
  'sitemap-accounts.xml', 'sitemap-apps.xml', 'test/register-account.test.mjs', 'test/roachclaw-chat.test.mjs', 'test/site-outcomes.mjs', 'netlify/functions/register-account.mjs', 'netlify/functions/roachclaw-chat.mjs',
]

if (reconcile) {
  const blocks = await Promise.all(sourceFiles.map(async (file) => {
    const name = file.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `## ${file}\n\nThis root is reconciled byte-for-byte from the current production source.\n\n\`\`\`text {chunk="${name}" file="${file}"}\n${await readFile(path.join(root, file), 'utf8')}\`\`\``
  }))
  const document = `# RoachNet.org Site Code\n\nThis literate source records the current site roots. Run \`node scripts/tangle.mjs --verify\` before writing generated roots; \`--output-dir\` stages a checked output tree without changing the repository. Additive chunks use double-angle references; duplicate roots, missing references, cycles, and unsafe paths are rejected.\n\n\`\`\`mermaid\nflowchart LR\n  Sources[Site sources] --> Builds[Main, accounts, and apps builders]\n  Builds --> Sites[Generated static sites]\n  Lit[ROACHNET-ORG.lit.md] --> Tangler[Strict tangler]\n  Tangler --> Verify[Byte verification]\n  Verify --> Sites\n\`\`\`\n\n${blocks.join('\n\n')}\n`
  await writeFile(path.join(root, 'ROACHNET-ORG.lit.md'), document, 'utf8')
  console.log(`Reconciled ${sourceFiles.length} literate roots`)
  process.exit(0)
}

const document = await readFile(path.join(root, 'ROACHNET-ORG.lit.md'), 'utf8')
const chunks = parse(document)
const roots = [...chunks.entries()].filter(([, chunk]) => chunk.target)
const outputs = roots.map(([name, chunk]) => ({ name, chunk, expected: expand(name, chunks) }))
for (const { chunk, expected } of outputs) {
  const target = path.resolve(outputDirectory, chunk.target)
  if (!target.startsWith(`${outputDirectory}${path.sep}`)) throw new Error(`Chunk path escapes output directory: ${chunk.target}`)
  let actual = null
  try {
    actual = await readFile(target, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (verify && actual !== expected) throw new Error(`Tangle mismatch: ${chunk.target}`)
}
if (write) {
  // All roots are compared before any write, preventing partial stale overwrites.
  for (const { chunk, expected } of outputs) {
    const target = path.resolve(outputDirectory, chunk.target)
    await mkdir(path.dirname(target), { recursive: true })
    let actual = null
    try {
      actual = await readFile(target, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (actual !== expected) await writeFile(target, expected, 'utf8')
  }
}

console.log(`${write ? 'Wrote' : 'Verified'} ${roots.length} literate roots`)
