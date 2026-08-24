#!/usr/bin/env node

import { HtmlValidate } from 'html-validate'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoots = ['website-main-dist', 'website-accounts-dist', 'website-apps-dist']

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return htmlFiles(target)
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : []
  }))
  return nested.flat()
}

const validator = new HtmlValidate(JSON.parse(await readFile(path.join(root, 'html-validate.json'), 'utf8')))
const files = (await Promise.all(outputRoots.map((directory) => htmlFiles(path.join(root, directory))))).flat()
const reports = await Promise.all(files.map(async (file) => ({ file, report: await validator.validateString(await readFile(file, 'utf8'), file) })))
const errors = reports.flatMap(({ file, report }) => report.results.flatMap((result) => result.messages.map((message) => `${path.relative(root, file)}:${message.line}:${message.column} ${message.message} (${message.ruleId})`)))

if (errors.length) throw new Error(`HTML validation failed:\n${errors.join('\n')}`)
console.log(`Validated ${files.length} generated HTML5 documents`)
