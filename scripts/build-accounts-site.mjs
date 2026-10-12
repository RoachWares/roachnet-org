#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputRoot = path.join(repoRoot, 'website-accounts-dist')

async function main() {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })

  const copyTargets = [
    'account.js',
    'router.js',
    'site-account.js',
    'site-config.js',
    'saved-apps-bridge.html',
    'saved-apps-bridge.js',
    'nx.css',
    'nx-account.css',
    'nx.js',
    'nx-halloween.js',
    'nx-halloween.css',
    'nx-halloween-themes.css',
    'fonts',
    'vendor/supabase-js',
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

  await cp(path.join(repoRoot, 'account/index.html'), path.join(outputRoot, 'index.html'), {
    force: true,
  })
  await cp(path.join(repoRoot, 'robots-accounts.txt'), path.join(outputRoot, 'robots.txt'))
  await cp(path.join(repoRoot, 'sitemap-accounts.xml'), path.join(outputRoot, 'sitemap.xml'))
  await cp(path.join(repoRoot, '404.html'), path.join(outputRoot, '404.html'))

  const accountPage = path.join(outputRoot, 'index.html')
  await writeFile(accountPage, (await readFile(accountPage, 'utf8'))
    .replace('class="site-header__actions" aria-label', 'class="site-header__actions" role="group" aria-label')
    .replace('class="account-chip-row" aria-label', 'class="account-chip-row" role="group" aria-label')
    .replace('<label class="account-honeypot" aria-hidden="true">', '<div class="account-honeypot" aria-hidden="true">')
    .replace('              </label>\n\n              <div class="account-turnstile"', '              </div>\n\n              <div class="account-turnstile"')
    .replaceAll('class="rc-lane-dot rc-lane-dot--web" aria-label', 'class="rc-lane-dot rc-lane-dot--web" role="img" aria-label')
    .replace('class="rc-lane-dot rc-lane-dot--local" aria-label', 'class="rc-lane-dot rc-lane-dot--local" role="img" aria-label')
    .replaceAll('<div class="rc-starter-card__icon">', '<span class="rc-starter-card__icon">')
    .replaceAll('</svg>\n                    </div>\n                    <strong>', '</svg>\n                    </span>\n                    <strong>'), 'utf8')

  await writeFile(
    path.join(outputRoot, '_redirects'),
    [
      '/account / 301',
      '/account/* /:splat 301',
      '/roachclaw /index.html 200',
      '/404.html /404.html 404',
    ].join('\n') + '\n',
    'utf8'
  )

  // Only the Apps store may frame these pages: it frames saved-apps-bridge.html
  // so its Save button can reach your account without the session ever leaving
  // this origin. Netlify merges header rules, so a per-path exception can't
  // loosen a site-wide 'none'; the allowance is the store's origin, site-wide.
  // X-Frame-Options can't name an origin, so CSP frame-ancestors carries it.
  await writeFile(
    path.join(outputRoot, '_headers'),
    [
      '/*',
      "  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self' https://roachnet.org https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; form-action 'self'; frame-ancestors https://apps.roachnet.org; frame-src https://challenges.cloudflare.com; img-src 'self' data: https:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests",
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
      '  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()',
    ].join('\n') + '\n',
    'utf8'
  )

  console.log(`Built Accounts site into ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
