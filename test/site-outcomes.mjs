import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { HtmlValidate } from 'html-validate'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)

async function source(file) {
  return readFile(path.join(root, file), 'utf8')
}

const netlify = await source('netlify.toml')
assert.match(netlify, /\[build\]\s+publish = "website-main-dist"\s+command = "npm run build:main:deploy"/)
assert.match(netlify, /\[functions\]\s+directory = "netlify\/functions"/)
assert.match(netlify, /from = "\/apps"\s+to = "https:\/\/apps\.roachnet\.org\/"\s+status = 301/s)
assert.match(netlify, /Strict-Transport-Security/)
assert.match(netlify, /Permissions-Policy/)
assert.match(netlify, /Content-Security-Policy/)
assert.match(netlify, /frame-ancestors 'none'/)
assert.match(netlify, /script-src[^"\n]*https:\/\/cdn\.jsdelivr\.net/)
assert.match(netlify, /script-src[^"\n]*sha256-QiHqwLZuL\/pVgJffI8ko4lWWbhUgm8d98y\+2YTSbnBU=/)
assert.match(netlify, /script-src[^"\n]*sha256-qLy8IxmePVj8e3iEGcT8WZulBFGCcodug2V4DgZ6pFw=/)
assert.match(netlify, /script-src-attr 'none'/)
assert.doesNotMatch(await source('sitemap.xml'), /https:\/\/(apps|accounts)\.roachnet\.org|https:\/\/www\.roachwares\.org/)

const appsBuild = await source('scripts/build-apps-site.mjs')
const accountsBuild = await source('scripts/build-accounts-site.mjs')
for (const build of [appsBuild, accountsBuild]) {
  assert.match(build, /'\/404\.html \/404\.html 404'/)
  assert.doesNotMatch(build, /'\/\* \/index\.html 200'/)
  assert.match(build, /'robots\.txt'/)
  assert.match(build, /'sitemap\.xml'/)
  assert.match(build, /'_headers'/)
  assert.match(build, /X-Frame-Options: DENY/)
  assert.match(build, /Permissions-Policy:/)
  assert.match(build, /Content-Security-Policy:/)
  assert.match(build, /frame-ancestors 'none'/)
}
assert.doesNotMatch(accountsBuild, /^\s*'assets',$/m)
assert.doesNotMatch(appsBuild, /^\s*'assets',$/m)

await Promise.all([
  run(process.execPath, ['scripts/build-main-site.mjs'], { cwd: root }),
  run(process.execPath, ['scripts/build-main-site.mjs'], { cwd: root }),
])
assert.equal(
  await source('website-main-dist/404.html'),
  await source('404.html'),
  'build:main must stage canonical 404.html byte-for-byte'
)
const mainHtml = await source('website-main-dist/index.html')
for (const unnecessaryResource of [
  'https://fonts.googleapis.com/',
  './app.css',
  './app-polish.css',
  './app.js',
  './site-config.js',
  './site-polish.js',
]) {
  assert.doesNotMatch(mainHtml, new RegExp(unnecessaryResource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `generated main must not load ${unnecessaryResource}`)
}
assert.match(mainHtml, /<link rel="stylesheet" href="\.\/landing\.css" \/>/)
assert.match(mainHtml, /<script src="\.\/landing-script\.js"><\/script>/)
assert.match(mainHtml, /<img[^>]+src="https:\/\/www\.netlify\.com\/assets\/badges\/netlify-badge-color-accent\.svg"[^>]+width="[^"]+"[^>]+height="[^"]+"/)

const landingHtml = await source('index.html')
const landingCss = await source('landing.css')
const landingScript = await source('landing-script.js')
assert.doesNotMatch(landingHtml, /dither-(?:bg|canvas)|<canvas\b|Dithered parallax/i, 'landing must not ship a decorative canvas background')
assert.doesNotMatch(landingHtml, /<script>[\s\S]*?<\/script>/, 'landing must not ship inline executable scripts')
assert.doesNotMatch(landingScript, /queueBurst|requestAnimationFrame|initLanding(?:PointerField|ClickRipples)/, 'landing must not run decorative continuous or pointer animation')
assert.doesNotMatch(landingCss, /\.dither-bg|why-rail-shift|\.is-bursting|rn-click-ripple--landing/, 'landing must not retain decorative animation styles')
assert.match(landingCss, /body\.rn-body \.rn-skip-link\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#000;/s, 'landing skip link needs an explicit high-contrast default style')
assert.match(landingHtml, /aria-label="Latest RoachNet release v1\.0\.5"/, 'release accessible name must include its visible version')
assert.match(landingHtml, /<img class="rn-logo-img" src="\.\/favicon-32x32\.png" width="26" height="26"/, 'landing must request a local icon sized for its rendered logo')
const landingLogo = await readFile(path.join(root, 'favicon-32x32.png'))
assert.equal(landingLogo.readUInt32BE(16), 32, 'landing logo width budget')
assert.equal(landingLogo.readUInt32BE(20), 32, 'landing logo height budget')
assert.ok((await stat(path.join(root, 'favicon-32x32.png'))).size <= 1024, 'landing logo byte budget')

await run(process.execPath, ['scripts/build-accounts-site.mjs'], { cwd: root })
const accountsHtml = await source('website-accounts-dist/index.html')
const accountsValidation = await new HtmlValidate({
  elements: ['html5'],
  rules: {
    'close-order': 'error',
    'no-multiple-main': 'error',
  },
}).validateString(accountsHtml, 'website-accounts-dist/index.html')
assert.equal(accountsValidation.valid, true, 'generated Accounts HTML must have one closed main element')

const publicPages = [
  'index.html',
  'home/index.html',
  'ios/index.html',
  'api/index.html',
  'brew/index.html',
  'sitemap/index.html',
  'roachclaw/index.html',
  'account/index.html',
  'app-store.html',
]
for (const page of publicPages) {
  const html = await source(page)
  assert.match(html, /class="rn-skip-link"/, `${page} needs a keyboard bypass link`)
  assert.match(html, /<main[^>]+id="[^"]+"/, `${page} needs a skip-link main target`)
}
assert.match(await source('app-store.html'), /<h1[ >]/)
for (const page of ['index.html', 'home/index.html', 'brew/index.html', 'app-store.html']) {
  const html = await source(page)
  assert.match(html, /not Apple-notarized/i, `${page} needs release-notarization disclosure`)
  assert.doesNotMatch(html, /\b(?:is|which is) unsigned\b/i, `${page} must not claim the macOS release is unsigned`)
}
const packageManifest = await source('package.json')
assert.match(packageManifest, /"build:main:deploy": "npm run verify && npm run build:main"/)
assert.match(packageManifest, /"tangle:write": "node scripts\/tangle\.mjs --write && node scripts\/tangle\.mjs --verify"/)

const chat = await source('netlify/functions/roachclaw-chat.mjs')
assert.match(chat, /function isAllowedBridgeUrl/)
assert.match(chat, /function isAllowedRequestOrigin/)
assert.equal([...chat.matchAll(/!isAllowedBridgeUrl/g)].length, 2)
assert.match(chat, /redirect: 'error'/)
assert.match(chat, /signal: AbortSignal\.timeout/)

const registration = await source('netlify/functions/register-account.mjs')
assert.match(registration, /function isAllowedRequestOrigin/)
assert.match(registration, /ROACHNET_TURNSTILE_SECRET_KEY/)
assert.match(registration, /getStore\('roachnet-registration-rate-limits'\)/)
assert.match(registration, /\/auth\/v1\/signup/)
assert.doesNotMatch(registration, /\/auth\/v1\/admin\/users|SERVICE_ROLE|email_confirm/)

const accountClient = await source('account.js')
assert.match(
  accountClient,
  /if \(accountMode === 'signup'\) \{[\s\S]*await registerAccount\([\s\S]*return[\s\S]*\}\s*const result = await authState\.client\.auth\.signInWithPassword/,
  'signup must wait for confirmation instead of immediately attempting password sign-in'
)
assert.match(accountClient, /Check your email to confirm your account/)

process.env.ROACHNET_SUPABASE_URL = 'https://example.supabase.co'
process.env.ROACHNET_SUPABASE_ANON_KEY = 'public-key'
process.env.ROACHNET_WEB_CHAT_ENABLED = '1'
process.env.ROACHNET_ALLOWED_BRIDGE_ORIGINS = 'https://paired.example'
const { default: chatHandler } = await import('../netlify/functions/roachclaw-chat.mjs')
const { default: registerHandler } = await import('../netlify/functions/register-account.mjs')
globalThis.fetch = async () => new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
for (const handler of [chatHandler, registerHandler]) {
  const rejectedOrigin = await handler(
    new Request('https://roachnet.org/.netlify/functions/test', {
      method: 'POST',
      headers: { authorization: 'Bearer session', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'person@example.com', password: 'long-enough-password', message: 'hello' }),
    })
  )
  assert.equal(rejectedOrigin.status, 403)
}
const blockedBridge = await chatHandler(
  new Request('https://roachnet.org/.netlify/functions/roachclaw-chat', {
    method: 'POST',
    headers: { authorization: 'Bearer session', origin: 'https://roachnet.org' },
    body: JSON.stringify({ message: 'hello', bridgeUrl: 'http://127.0.0.1:8080' }),
  })
)
assert.equal(blockedBridge.status, 400)

console.log('site outcome checks passed')
