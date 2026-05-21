#!/usr/bin/env node

import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputRoot = path.join(repoRoot, 'website-apps-dist')

function assertInstallIntent(item, condition, message) {
  if (!condition) {
    throw new Error(`App Store install contract failed for ${item.id || item.title}: ${message}`)
  }
}

async function validateAppStoreInstallContract() {
  const catalog = JSON.parse(await readFile(path.join(repoRoot, 'app-store-catalog.json'), 'utf8'))
  const items = Array.isArray(catalog.items) ? catalog.items : []
  assertInstallIntent({ id: 'catalog' }, items.length > 0, 'catalog has no installable items')

  const supportedActions = new Set([
    'base-map-assets',
    'direct-download',
    'map-collection',
    'education-tier',
    'education-resource',
    'wikipedia-option',
    'roachclaw-model',
    'roachspeech-pack',
  ])

  for (const item of items) {
    const intent = item.installIntent || {}
    const action = intent.action
    assertInstallIntent(item, action, 'missing installIntent.action')
    assertInstallIntent(item, supportedActions.has(action), `unsupported install action "${action}"`)
    const params = new URLSearchParams()
    Object.entries({
      id: item.id,
      title: item.title,
      category: item.section || item.category,
      ...intent,
    }).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    const installURL = new URL(`roachnet://install-content?${params.toString()}`)
    assertInstallIntent(item, installURL.protocol === 'roachnet:', 'install URL must use the roachnet scheme')
    assertInstallIntent(item, installURL.host === 'install-content', 'install URL must target the native install-content route')

    if (action === 'direct-download') {
      assertInstallIntent(item, intent.url, 'direct downloads need a descriptor URL')
      assertInstallIntent(item, intent.filetype, 'direct downloads need a filetype')
    }
    if (action === 'map-collection') {
      assertInstallIntent(item, intent.slug, 'map collections need a slug')
    }
    if (action === 'education-tier') {
      assertInstallIntent(item, intent.category && intent.tier, 'education tiers need category and tier')
    }
    if (action === 'education-resource') {
      assertInstallIntent(item, intent.category && intent.resource, 'education resources need category and resource')
    }
    if (action === 'wikipedia-option') {
      assertInstallIntent(item, intent.option, 'Wikipedia options need an option id')
    }
    if (action === 'roachclaw-model') {
      assertInstallIntent(item, intent.model, 'RoachClaw installs need a model name')
    }
    if (action === 'roachspeech-pack') {
      assertInstallIntent(item, intent.url && intent.pack && intent.kind, 'RoachSpeech packs need url, pack, and kind')
    }

    assertInstallIntent(item, item.iconAsset, 'missing iconAsset')
    const iconPath = path.resolve(repoRoot, item.iconAsset.replace(/^\.\//, ''))
    try {
      await access(iconPath)
    } catch {
      throw new Error(`App Store icon missing for ${item.id || item.title}: ${item.iconAsset}`)
    }
  }

  const appStoreSource = await readFile(path.join(repoRoot, 'app-store.js'), 'utf8')
  assertInstallIntent({ id: 'app-store.js' }, appStoreSource.includes('roachnet://install-content'), 'install buttons must open native RoachNet deep links')
  assertInstallIntent({ id: 'app-store.js' }, appStoreSource.includes('attemptNativeInstall'), 'install buttons must use the native install handoff')
}

async function main() {
  await validateAppStoreInstallContract()
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })

  const copyTargets = [
    'app.css',
    'app-polish.css',
    'app.js',
    'app-store.js',
    'app-store-catalog.json',
    'site-polish.js',
    'site-config.js',
    'collections',
    'downloads',
    'assets',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
  ]

  for (const target of copyTargets) {
    await cp(path.join(repoRoot, target), path.join(outputRoot, target), {
      recursive: true,
      force: true,
    })
  }

  await cp(path.join(repoRoot, 'app-store.html'), path.join(outputRoot, 'index.html'), {
    force: true,
  })

  await writeFile(
    path.join(outputRoot, '_redirects'),
    [
      '/app-store.html / 301',
      '/downloads/* /downloads/:splat 200',
      '/* /index.html 200',
    ].join('\n') + '\n',
    'utf8'
  )

  console.log(`Built Apps site into ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
