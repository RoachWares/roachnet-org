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
// Netlify matches redirect paths with or without a trailing slash, so a forced rule from a
// page to the same path plus "/" (or "/x/*" to "/x/:splat") redirects that page to itself forever.
for (const [, from, to] of netlify.matchAll(/from = "([^"]+)"\s+to = "([^"]+)"/g)) {
  const bare = (value) => value.replace(/\/(\*|:splat)?$/, '')
  if (!/^https?:/.test(to)) assert.notEqual(bare(from), bare(to), `redirect ${from} -> ${to} loops on Netlify`)
}
assert.match(netlify, /Strict-Transport-Security/)
assert.match(netlify, /Permissions-Policy/)
assert.match(netlify, /Content-Security-Policy/)
assert.match(netlify, /frame-ancestors 'none'/)
assert.doesNotMatch(netlify, /cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/, 'every script, style and font is self-hosted')
assert.match(netlify, /style-src 'self';/, 'no page needs inline styles')
assert.doesNotMatch(netlify, /script-src [^;"\n]*(?:'unsafe-inline'|sha256-)/, 'no page needs inline scripts, so the CSP allows none')
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
assert.match(mainHtml, /<link rel="stylesheet" href="\.\/nx\.css" \/>/)
assert.match(mainHtml, /<link rel="stylesheet" href="\.\/nx-mission\.css" \/>/)
assert.match(mainHtml, /<script src="\.\/landing-script\.js"><\/script>/)
assert.match(mainHtml, /<script src="\.\/landing-dither\.js"><\/script>/)
assert.match(mainHtml, /<script src="\.\/nx\.js" type="module"><\/script>/)
assert.match(mainHtml, /<img[^>]+src="https:\/\/www\.netlify\.com\/assets\/badges\/netlify-badge-color-accent\.svg"[^>]+width="[^"]+"[^>]+height="[^"]+"/)

// Motion policy: the Mission page may animate, but every decorative effect has to
// stand down for reduced motion, skip coarse pointers where it follows the pointer,
// and stop looping while the tab is hidden. No inline scripts (the CSP has no
// 'unsafe-inline').
const landingHtml = await source('index.html')
const nxCss = await source('nx.css')
const missionCss = await source('nx-mission.css')
const landingScript = await source('landing-script.js')
const landingDither = await source('landing-dither.js')
const nxScript = await source('nx.js')
assert.doesNotMatch(landingHtml, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/, 'landing must not ship inline executable scripts')
assert.doesNotMatch(landingHtml, /\/\.netlify\/scripts\/|cdn-cgi/, 'landing must not carry edge-injected scripts')
assert.match(landingHtml, /<div class="dither-bg" aria-hidden="true">/, 'decorative canvas must be hidden from assistive tech')
for (const [name, script] of [['landing-script.js', landingScript], ['landing-dither.js', landingDither], ['nx.js', nxScript]]) {
  assert.match(script, /prefers-reduced-motion: reduce/, `${name} must honor reduced motion`)
}
assert.match(landingScript, /pointer: fine/, 'pointer-following effects must skip coarse pointers')
assert.match(landingScript, /function initLandingPointerField\(\) \{\n  if \(!pointerMotion\(\)\) return;/, 'pointer field must be gated')
assert.match(landingScript, /function initLandingClickRipples\(\) \{\n  if \(!decorativeMotion\(\)\) return;/, 'click ripples must be gated')
assert.match(landingScript, /document\.hidden/, 'glitch bursts must pause in a hidden tab')
assert.match(landingDither, /visibilityState === 'hidden'/, 'dither loop must pause in a hidden tab')
assert.match(landingScript, /setAttribute\('aria-label', `Latest RoachNet release \$\{d\.tag_name\}`\)/, 'release chip accessible name must follow the live tag')
assert.doesNotMatch(landingHtml, /why-cap-card__icon" aria-hidden="true">&#xe2;/, 'capability icons must render (no mojibake glyphs)')
assert.match(nxCss, /html\.nx \.rn-skip-link\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#000;/s, 'skip link needs an explicit high-contrast default style')
assert.match(nxCss, /@media \(prefers-reduced-motion: reduce\)/, 'nx.css must stand decorative motion down')
assert.match(missionCss, /@media \(prefers-reduced-motion: reduce\)/, 'Mission styles must stand decorative motion down')
assert.doesNotMatch(landingHtml, /why-blockquote__lines" aria-hidden/, 'the three blockquote lines are content, not decoration')
assert.match(landingHtml, /aria-label="Latest RoachNet release v1\.0\.6"/, 'release accessible name must include its visible version')
assert.match(landingHtml, /<a class="nx-nav__link is-current" href="#top" aria-current="page">Mission<\/a>/, 'Mission is the current page in the nav')
const landingLogo = await readFile(path.join(root, 'favicon-32x32.png'))
assert.equal(landingLogo.readUInt32BE(16), 32, 'favicon width budget')
assert.equal(landingLogo.readUInt32BE(20), 32, 'favicon height budget')
assert.ok((await stat(path.join(root, 'favicon-32x32.png'))).size <= 1024, 'favicon byte budget')

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
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/, `${page} must not ship inline executable scripts (CSP)`)
  assert.match(html, /class="rn-skip-link"/, `${page} needs a keyboard bypass link`)
  assert.match(html, /<main[^>]+id="[^"]+"/, `${page} needs a skip-link main target`)
  const footers = [...html.matchAll(/<footer\b[\s\S]*?<\/footer>/gi)].map(([footer]) => footer)
  assert.ok(footers.length > 0, `${page} needs a footer`)
  for (const [index, footer] of footers.entries()) {
    const sitemapLinks = [...footer.matchAll(/<a\s+[^>]*href="https:\/\/roachnet\.org\/sitemap\/"[^>]*>\s*Sitemap\s*<\/a>/gi)]
    assert.equal(sitemapLinks.length, 1, `${page} footer ${index + 1} needs exactly one Sitemap link`)
  }
}
assert.match(await source('app-store.html'), /<h1[ >]/)

// Halloween mode: every page loads the switch in <head> (so the theme lands before
// first paint), the script stays CSP-clean, and the decorations stand down for
// reduced motion, forced colours and print.
for (const page of [...publicPages, '404.html']) {
  const headHtml = (await source(page)).split('</head>')[0]
  assert.match(headHtml, /<script src="[^"]*nx-halloween\.js"><\/script>/, `${page} loads nx-halloween.js in <head>`)
}
const halloween = await source('nx-halloween.js')
assert.doesNotMatch(halloween, /innerHTML|insertAdjacentHTML|setAttribute\(\s*['"]style|cssText|eval\(|new Function/, 'Halloween mode builds nodes, never HTML strings or inline styles')
assert.match(halloween, /prefers-reduced-motion: reduce/)
assert.match(halloween, /samesite=lax/)
assert.doesNotMatch(halloween, /localStorage|fetch\(|XMLHttpRequest|sendBeacon/, 'Halloween mode keeps one cookie and talks to nobody')
const halloweenCss = await source('nx-halloween.css')
assert.doesNotMatch(await source('nx.css'), /data-halloween/, 'the Halloween theme stays out of nx.css, so it costs nothing out of season')
assert.match(halloween, /blocking', 'render'/, 'the Halloween stylesheet blocks render, so there is no flash of the normal theme')
for (const query of ['prefers-reduced-motion: reduce', 'forced-colors: active', 'print']) {
  assert.match(halloweenCss, new RegExp(`@media \\(?${query.replace(/[()]/g, '')}`), `Halloween CSS handles ${query}`)
}
for (const build of ['scripts/build-main-site.mjs', 'scripts/build-apps-site.mjs', 'scripts/build-accounts-site.mjs']) {
  assert.match(await source(build), /nx-halloween\.js/, `${build} ships nx-halloween.js`)
  assert.match(await source(build), /nx-halloween\.css/, `${build} ships nx-halloween.css`)
}

// The landing download is a plain navigation handed to Home, not a hidden iframe
// (the CSP's frame-src admits only Turnstile, so an iframe download never starts).
const appScript = await source('app.js')
assert.doesNotMatch(appScript, /createElement\('iframe'\)/)
assert.match(appScript, /function startHandedOffDownload/)
assert.match(appScript, /hostname === 'github\.com'/)
// Sign-up needs a real Turnstile site key whenever the human check is switched on
// (the secret lives only in the Netlify environment, never in the repo).
{
  const siteConfig = JSON.parse((await source('site-config.js')).replace(/^window\.__ROACHNET_SITE_CONFIG__ = /, '').replace(/;?\s*$/, ''))
  if (siteConfig.turnstile.enabled) assert.match(siteConfig.turnstile.siteKey, /^0x4[A-Za-z0-9_-]{18,}$/, 'Turnstile is on but the site key is missing')
  assert.doesNotMatch(await source('site-config.js'), /secret/i, 'site-config.js is public: no secrets')
}
// Accounts posts sign-ups to the roachnet.org function, so its CSP must allow it.
assert.match(accountsBuild, /connect-src 'self' https:\/\/roachnet\.org /)
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

// The iOS page's buttons and its script must point at the same, current IPA.
const iosPage = await source('ios/index.html')
const iosScript = await source('ios/ios-install.js')
const pageIpas = new Set([...iosPage.matchAll(/data-ipa-download href="([^"]+)"/g)].map(([, href]) => href))
assert.equal(pageIpas.size, 1, 'every IPA button on the iOS page uses one URL')
const [pageIpa] = pageIpas
assert.match(pageIpa, /RoachNetiOS-v0\.2\.0-unsigned\.ipa$/)
for (const [ipa] of iosScript.matchAll(/https:\/\/[^'"\s]+\.ipa/g)) {
  assert.equal(ipa, pageIpa, 'ios-install.js must not override the page with a different IPA')
}

// The Homebrew helper zip is what the Install with Homebrew button downloads: it must hold the
// current script, executable, at the zip root, with no macOS metadata riding along.
{
  const { inflateRawSync } = await import('node:zlib')
  const zip = await readFile(path.join(root, 'downloads/RoachNet-Homebrew.command.zip'))
  const script = await readFile(path.join(root, 'downloads/RoachNet-Homebrew.command'))
  const endOfDirectory = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(endOfDirectory >= 0, 'helper zip has a central directory')
  const entryCount = zip.readUInt16LE(endOfDirectory + 10)
  let offset = zip.readUInt32LE(endOfDirectory + 16)
  const entries = []
  for (let index = 0; index < entryCount; index += 1) {
    const nameLength = zip.readUInt16LE(offset + 28)
    entries.push({
      name: zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
      method: zip.readUInt16LE(offset + 10),
      compressedSize: zip.readUInt32LE(offset + 20),
      mode: zip.readUInt32LE(offset + 38) >>> 16,
      localOffset: zip.readUInt32LE(offset + 42),
    })
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32)
  }
  assert.deepEqual(entries.map(({ name }) => name), ['RoachNet-Homebrew.command'])
  const [entry] = entries
  assert.equal(entry.mode & 0o777, 0o755, 'the helper is executable once unzipped')
  const dataStart = entry.localOffset + 30 + zip.readUInt16LE(entry.localOffset + 26) + zip.readUInt16LE(entry.localOffset + 28)
  const packed = zip.subarray(dataStart, dataStart + entry.compressedSize)
  const unpacked = entry.method === 8 ? inflateRawSync(packed) : packed
  assert.ok(unpacked.equals(script), 'helper zip matches downloads/RoachNet-Homebrew.command')
  assert.match(script.toString('utf8'), /brew tap --force RoachWares\/roachnet/)
  assert.doesNotMatch(script.toString('utf8'), /AHGRoach/)
}

// Copy facts that drifted once: page anchors that live on /home/, and the browser storage line.
for (const file of ['app.js', 'app-store.js', 'scripts/build-app-store-catalog.mjs']) {
  assert.doesNotMatch(await source(file), /https:\/\/roachnet\.org\/#(?:screens|downloads)/, `${file} links /home/ anchors`)
}
assert.doesNotMatch(await source('app.js'), /free \(approx\.\)/, 'a browser cannot see free disk space')
const catalogText = await source('app-store-catalog.json')
assert.doesNotMatch(catalogText, /District Of Columbia|Of The Northern/)
assert.doesNotMatch(catalogText, /"(?:subtitle|status|summary|machineFit)": "[^"]*\blane\b/i, 'store cards skip the internal "lane" jargon')

console.log('site outcome checks passed')
