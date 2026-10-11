#!/usr/bin/env node

// Checks website-main-deploy/ (made by build-main-deploy.mjs) before it is
// uploaded: the layout Netlify expects, the native runtime files, the function
// tests run against the bundled functions, and, on Linux x64, that the bundled
// chat function really loads its runtime.

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'website-main-deploy')

async function size(file) {
  return (await stat(path.join(out, file))).size
}

const toml = await readFile(path.join(out, 'netlify.toml'), 'utf8')
assert.match(toml, /^\[build\]\n# Prebuilt upload made by scripts\/build-main-deploy\.mjs\.\npublish = "site"\ncommand = "echo prebuilt"\n/)
assert.match(toml, /\[functions\.roachclaw-chat\]\nincluded_files = \["roachbrain-runtime\/\*\*"\]/)
assert.ok((await size('site/index.html')) > 0, 'site/index.html')
assert.ok((await size('site/home/index.html')) > 0, 'site/home/index.html')
for (const file of [
  'roachbrain-runtime/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node',
  'roachbrain-runtime/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1',
  'roachbrain-runtime/onnxruntime-node/dist/index.js',
  'roachbrain-runtime/onnxruntime-common/dist/esm/index.js',
  'roachbrain-runtime/sharp/index.js',
]) {
  assert.ok((await size(file)) > 0, file)
}
const { execFileSync } = await import('node:child_process')
const named = execFileSync('find', [out, '-name', 'node_modules'], { encoding: 'utf8' }).trim()
assert.equal(named, '', 'nothing in the upload is called node_modules')
const chat = await readFile(path.join(out, 'netlify/functions/roachclaw-chat.mjs'), 'utf8')
assert.doesNotMatch(chat, /from ["'][^"']*onnxruntime|from ["']sharp["']|from ["'][^"']*roachbrain-runtime/, 'the runtime is never imported when the function loads')
assert.match(chat, /__roachnetRuntimeRequire\("\.\.\/\.\.\/roachbrain-runtime\/onnxruntime-node\/dist\/index\.js"\)/)
assert.doesNotMatch(chat, /transformers\.web\.js/, 'the Node build of transformers is bundled, not the web build')

// The function tests, pointed at the bundles.
const scratch = await mkdtemp(path.join(os.tmpdir(), 'roachnet-deploy-check-'))
try {
  await mkdir(path.join(scratch, 'test'), { recursive: true })
  for (const name of ['register-account', 'roachclaw-chat']) {
    const testSource = await readFile(path.join(root, 'test', `${name}.test.mjs`), 'utf8')
    const bundled = pathToFileURL(path.join(out, 'netlify/functions', `${name}.mjs`)).href
    const pointed = testSource.replace(`'../netlify/functions/${name}.mjs'`, `'${bundled}'`)
    assert.notEqual(pointed, testSource, `${name} test imports its function`)
    await writeFile(path.join(scratch, 'test', `${name}.test.mjs`), pointed)
  }
  const { stdout } = await run(process.execPath, ['--test', '--test-reporter=tap', 'test/register-account.test.mjs', 'test/roachclaw-chat.test.mjs'], { cwd: scratch })
  const passed = /# pass (\d+)/.exec(stdout)?.[1]
  assert.match(stdout, /# fail 0/)
  console.log(`Bundled function tests: ${passed} passed`)
} finally {
  await rm(scratch, { recursive: true, force: true })
}

if (process.platform === 'linux' && process.arch === 'x64') {
  const bundle = await import(pathToFileURL(path.join(out, 'netlify/functions/roachclaw-chat.mjs')).href)
  const response = await bundle.default(new Request('https://roachnet.org/.netlify/functions/roachclaw-chat?health=runtime'))
  assert.equal(response.status, 200, 'the bundled chat function loads its native runtime')
  console.log('Bundled chat runtime loads on Linux x64')
} else {
  console.log(`Skipped the runtime load check: the bundle carries Linux x64 binaries and this is ${process.platform}-${process.arch}`)
}
console.log('roachnet.org deploy folder checks passed')
