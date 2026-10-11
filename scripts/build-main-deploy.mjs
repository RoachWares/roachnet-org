#!/usr/bin/env node

// Builds the prebuilt roachnet.org upload in website-main-deploy/.
//
// Netlify's own dependency install fails for this repo, so roachnet.org ships
// as a prebuilt folder: the static site in site/, the two functions bundled
// with esbuild in netlify/functions/, and the native ONNX runtime the hosted
// RoachClaw model needs in roachbrain-runtime/ (Linux x64 only, which is what
// Netlify Functions run on). The functions import that runtime by relative
// path, and netlify.toml lists it in included_files. Nothing in the upload is
// called node_modules, so no uploader or bundler default can skip it.

import { build } from 'esbuild'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'website-main-deploy')
const runtimeDir = 'roachbrain-runtime'
const functions = ['register-account', 'roachclaw-chat']

// Packages the hosted model loads at runtime instead of bundling: the native
// binding has to stay next to its .so, and onnxruntime-common must be the one
// instance that both transformers and onnxruntime-node see.
const runtimePackages = {
  'onnxruntime-node': ['package.json', 'dist', 'bin/napi-v3/linux/x64/onnxruntime_binding.node', 'bin/napi-v3/linux/x64/libonnxruntime.so.1', 'bin/napi-v3/linux/x64/libonnxruntime_providers_shared.so'],
  'onnxruntime-common': ['package.json', 'dist'],
  sharp: ['package.json', 'index.js'],
}

// CommonJS entries, required lazily (see runtimeImports): onnxruntime-node
// requires the CJS build of onnxruntime-common too, so there is one instance.
const runtimeEntry = {
  'onnxruntime-node': 'dist/index.js',
  'onnxruntime-common': 'dist/cjs/index.js',
  sharp: 'index.js',
}

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function copyRuntime() {
  for (const [name, entries] of Object.entries(runtimePackages)) {
    const source = path.join(root, 'node_modules', name)
    for (const entry of entries) {
      const from = path.join(source, entry)
      if (!(await exists(from))) throw new Error(`Missing runtime file ${name}/${entry}. Run npm ci first.`)
      const to = path.join(out, runtimeDir, name, entry)
      await mkdir(path.dirname(to), { recursive: true })
      await cp(from, to, { recursive: true, dereference: true })
    }
  }
  // onnxruntime-node finds onnxruntime-common by package name; point it at the
  // copy next to it instead.
  for (const file of ['dist/index.js', 'dist/binding.js']) {
    const target = path.join(out, runtimeDir, 'onnxruntime-node', file)
    const source = await readFile(target, 'utf8')
    const pointed = source.replaceAll('require("onnxruntime-common")', 'require("../../onnxruntime-common/dist/cjs/index.js")')
    if (pointed === source) throw new Error(`onnxruntime-node/${file} no longer requires onnxruntime-common by name`)
    await writeFile(target, pointed, 'utf8')
  }
  const leftovers = (await readFile(path.join(out, runtimeDir, 'onnxruntime-node/dist/backend.js'), 'utf8')).match(/require\("onnxruntime-common"\)/)
  if (leftovers) throw new Error('onnxruntime-node/dist/backend.js still requires onnxruntime-common by name')
}

// The runtime packages become small shims that require roachbrain-runtime/
// when transformers first runs, not when the function loads. esbuild keeps the
// dynamic import of transformers lazy, so a cold function that never answers
// with the hosted model (sign-in errors, rate limits, a bad request) never
// touches the native binding, and the bundle loads on any platform.
const runtimeImports = {
  name: 'roachbrain-runtime',
  setup(builder) {
    builder.onResolve({ filter: /^(onnxruntime-node|onnxruntime-common|sharp)$/ }, (args) => ({ path: args.path, namespace: 'roachbrain-runtime' }))
    builder.onLoad({ filter: /.*/, namespace: 'roachbrain-runtime' }, (args) => ({
      contents: `module.exports = __roachnetRuntimeRequire(${JSON.stringify(`../../${runtimeDir}/${args.path}/${runtimeEntry[args.path]}`)})`,
      loader: 'js',
    }))
  },
}

async function bundleFunctions() {
  const banner = "import { createRequire as __roachnetCreateRequire } from 'node:module'; const require = __roachnetCreateRequire(import.meta.url); const __roachnetRuntimeRequire = require;"
  for (const name of functions) {
    await build({
      entryPoints: [path.join(root, 'netlify/functions', `${name}.mjs`)],
      outfile: path.join(out, 'netlify/functions', `${name}.mjs`),
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      banner: { js: banner },
      logLevel: 'warning',
      plugins: [runtimeImports],
    })
  }
}

async function writeNetlifyToml() {
  const source = await readFile(path.join(root, 'netlify.toml'), 'utf8')
  const head = '[build]\npublish = "website-main-dist"\ncommand = "npm run build:main:deploy"\n'
  if (!source.startsWith(head)) throw new Error('netlify.toml no longer starts with the expected [build] block')
  const functionsBlock = '[functions]\ndirectory = "netlify/functions"\n'
  if (!source.includes(functionsBlock)) throw new Error('netlify.toml no longer has the expected [functions] block')
  const prebuilt = source
    .replace(head, '[build]\n# Prebuilt upload made by scripts/build-main-deploy.mjs.\npublish = "site"\ncommand = "echo prebuilt"\n')
    .replace(
      functionsBlock,
      `${functionsBlock}node_bundler = "nft"\n\n[functions.roachclaw-chat]\nincluded_files = ["${runtimeDir}/**"]\n`
    )
  await writeFile(path.join(out, 'netlify.toml'), prebuilt, 'utf8')
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(path.join(root, 'website-main-dist'), path.join(out, 'site'), { recursive: true })
await copyRuntime()
await bundleFunctions()
await writeNetlifyToml()
console.log(`Built the roachnet.org upload in ${out}`)
