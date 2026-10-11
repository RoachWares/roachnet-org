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
    'pack',
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
    if (action === 'pack') {
      assertInstallIntent(item, intent.pack, 'feature packs need the catalog pack id')
    }
    if (item.availability) {
      assertInstallIntent(item, ['unavailable', 'unsupported'].includes(item.availability.state) && item.availability.reason, 'availability needs a state and a reason')
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
    'app-store.js',
    'app-store-catalog.json',
    'site-config.js',
    'nx.css',
    'nx-store.css',
    'nx.js',
    'fonts',
    'collections',
    'downloads',
    'assets/app-icons',
    'assets/roachnet-logo.webp',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
  ]

  for (const target of copyTargets) {
    const destination = path.join(outputRoot, target)
    await mkdir(path.dirname(destination), { recursive: true })
    await cp(path.join(repoRoot, target), destination, {
      recursive: true,
      force: true,
    })
  }

  await cp(path.join(repoRoot, 'app-store.html'), path.join(outputRoot, 'index.html'), {
    force: true,
  })
  await cp(path.join(repoRoot, 'robots-apps.txt'), path.join(outputRoot, 'robots.txt'))
  await cp(path.join(repoRoot, 'sitemap-apps.xml'), path.join(outputRoot, 'sitemap.xml'))
  await cp(path.join(repoRoot, '404.html'), path.join(outputRoot, '404.html'))

  const appStore = path.join(outputRoot, 'index.html')
  await writeFile(appStore, (await readFile(appStore, 'utf8'))
    .replace('class="apps-artifact-lane" aria-label', 'class="apps-artifact-lane" role="group" aria-label')
    .replace('class="apps-store-sidebar__quick" aria-label', 'class="apps-store-sidebar__quick" role="group" aria-label')
    .replace('class="apps-store-topbar__status" aria-label', 'class="apps-store-topbar__status" role="group" aria-label'), 'utf8')

  await writeFile(
    path.join(outputRoot, '_redirects'),
    [
      '/app-store.html / 301',
      '/downloads/* /downloads/:splat 200',
      '/404.html /404.html 404',
    ].join('\n') + '\n',
    'utf8'
  )

  await writeFile(
    path.join(outputRoot, '_headers'),
    [
      '/*',
      "  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests",
      '  X-Frame-Options: DENY',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
      '  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()',
    ].join('\n') + '\n',
    'utf8'
  )

  console.log(`Built Apps site into ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
