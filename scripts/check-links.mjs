#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pages = ['index.html', 'home/index.html', 'ios/index.html', 'api/index.html', 'brew/index.html', 'roachclaw/index.html', 'account/index.html', 'app-store.html']
const urls = new Set()

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8')
  for (const match of html.matchAll(/(?:href|src)="(https:\/\/[^"#?]+(?:\?[^"#]*)?)"/g)) {
    urls.add(match[1])
  }
}

const failures = []
for (const url of urls) {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (response.status === 405) response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) failures.push(`${response.status} ${url}`)
  } catch (error) {
    failures.push(`${error.message} ${url}`)
  }
}

if (failures.length) throw new Error(`External link check failed:\n${failures.join('\n')}`)
console.log(`Verified ${urls.size} external links`)
