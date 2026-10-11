#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sites = [
  { name: 'main', directory: 'website-main-dist', pages: [['mission', '/'], ['home', '/home/'], ['ios', '/ios/'], ['api', '/api/'], ['brew', '/brew/'], ['sitemap', '/sitemap/'], ['roachclaw', '/roachclaw/']] },
  { name: 'accounts', directory: 'website-accounts-dist', pages: [['account', '/']] },
  { name: 'apps', directory: 'website-apps-dist', pages: [['catalog', '/']] },
]
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'], ['.webp', 'image/webp'], ['.xml', 'application/xml; charset=utf-8'],
])

async function findChromium() {
  const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH].filter(Boolean)
  try {
    const entries = await readdir('/opt/data/pw-browsers', { withFileTypes: true })
    for (const entry of entries.filter((item) => item.isDirectory() && item.name.startsWith('chromium-')).sort((a, b) => b.name.localeCompare(a.name))) {
      candidates.push(path.join('/opt/data/pw-browsers', entry.name, 'chrome-linux', 'chrome'))
      candidates.push(path.join('/opt/data/pw-browsers', entry.name, 'chrome-linux64', 'chrome'))
    }
  } catch {
    // The shared browser cache is optional outside the verification image.
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome')
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next known browser location.
    }
  }
  throw new Error('No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install Chromium.')
}

async function localFile(directory, urlPath) {
  const requested = decodeURIComponent(urlPath).replace(/^\/+/, '')
  const resolved = path.resolve(directory, requested || 'index.html')
  if (!resolved.startsWith(`${directory}${path.sep}`)) return null
  try {
    return (await stat(resolved)).isDirectory() ? path.join(resolved, 'index.html') : resolved
  } catch {
    return null
  }
}

// Serve each site with the Content-Security-Policy it ships with (netlify.toml for
// the main site, _headers for Apps and Accounts), so a CSP violation shows up as a
// console error and fails the page. upgrade-insecure-requests is dropped because
// the test server is plain http on loopback.
async function sitePolicy(site) {
  const source = site.name === 'main'
    ? await readFile(path.join(root, 'netlify.toml'), 'utf8')
    : await readFile(path.join(root, site.directory, '_headers'), 'utf8')
  const match = /Content-Security-Policy(?: = "|: )([^"\n]+)/.exec(source)
  assert.ok(match, `${site.name} ships a Content-Security-Policy`)
  return match[1].replace(/;\s*upgrade-insecure-requests/, '').trim()
}

async function startServer(directory, policy) {
  const server = http.createServer(async (request, response) => {
    const file = await localFile(directory, new URL(request.url, 'http://localhost').pathname)
    const target = file || path.join(directory, '404.html')
    const headers = { 'content-type': mime.get(path.extname(target)) || 'application/octet-stream', 'cache-control': 'no-store' }
    if (policy && target.endsWith('.html')) headers['content-security-policy'] = policy
    response.writeHead(file ? 200 : 404, headers)
    createReadStream(target).pipe(response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function checkPage(browser, baseUrl, pathname, viewport, label) {
  const page = await browser.newPage()
  const failures = []
  await page.setViewport(viewport)
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === baseUrl) return request.continue()
    return request.respond({ status: 200, contentType: request.resourceType() === 'fetch' ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: request.resourceType() === 'fetch' ? '{}' : '/* third-party script stubbed for the test */' })
  })
  try {
    const response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    assert.equal(response?.status(), 200, `${label} response`)
    await page.waitForFunction(() => document.querySelector('h1'), { timeout: 10_000 })
    await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 10_000 })
    const outcome = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const targets = [...document.querySelectorAll('a, button, input, select, textarea')].filter((target) => visible(target) && !target.closest('footer'))
      const strip = document.querySelector('.apps-hero-panel__strip')
      const stripItems = strip ? [...strip.children].map((child) => child.getBoundingClientRect()) : []
      const stripItemsOverlap = stripItems.some((rect, index) => stripItems.slice(index + 1).some((other) => !(
        rect.right <= other.left || other.right <= rect.left || rect.bottom <= other.top || other.bottom <= rect.top
      )))
      const shelfCardsFit = [...document.querySelectorAll('.apps-row__scroller')].every((scroller) => {
        const card = scroller.querySelector('.apps-card')
        return !card || card.getBoundingClientRect().width <= scroller.clientWidth + 1
      })
      const shelfCardsOverlap = [...document.querySelectorAll('.apps-row__scroller')].some((scroller) => {
        const cards = [...scroller.querySelectorAll('.apps-card')].map((card) => card.getBoundingClientRect()).sort((a, b) => a.left - b.left)
        return cards.some((card, index) => cards[index + 1] && card.right > cards[index + 1].left + 1)
      })
      return {
        bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
        h1s: [...document.querySelectorAll('h1')].filter(visible).length,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallTargets: targets.filter((target) => {
          const rect = target.getBoundingClientRect()
          return rect.width < 24 && rect.height < 24
        }).map((target) => target.outerHTML.slice(0, 120)),
        hasSkip: Boolean(document.querySelector('.rn-skip-link')),
        shelfCardsFit,
        shelfCardsOverlap,
        stripItemsOverlap,
      }
    })
    assert.ok(outcome.bodySize >= 16, `${label} body font is below 16px`)
    assert.equal(outcome.h1s, 1, `${label} must expose one visible h1`)
    assert.equal(outcome.overflow, false, `${label} has horizontal overflow`)
    assert.deepEqual(outcome.smallTargets, [], `${label} has targets below 24px`)
    assert.equal(outcome.shelfCardsFit, true, `${label} clips shelf cards inside their horizontal scroller`)
    assert.equal(outcome.shelfCardsOverlap, false, `${label} overlaps adjacent shelf cards`)
    assert.equal(outcome.stripItemsOverlap, false, `${label} overlaps featured metadata`)
    if (outcome.hasSkip) {
      await page.evaluate(() => {
        const skip = document.querySelector('.rn-skip-link')
        if (!(skip instanceof HTMLElement)) throw new Error('Skip link disappeared')
        skip.focus()
      })
      assert.equal(await page.evaluate(() => document.activeElement?.matches('.rn-skip-link')), true, `${label} skip link cannot receive focus`)
      await page.evaluate(() => {
        const skip = document.querySelector('.rn-skip-link')
        if (!(skip instanceof HTMLElement)) throw new Error('Skip link disappeared')
        skip.click()
      })
      await page.waitForFunction(() => document.activeElement?.matches('main, [role="main"]'), { timeout: 5_000 })
    }
    assert.deepEqual(failures, [], `${label} browser failures`)
  } finally {
    await page.close()
  }
}

// Halloween mode: pin the date, then check the switch, the cookie, the decorations
// and that the moon never sits behind the first heading.
async function halloweenPage(browser, baseUrl, pathname, { iso, viewport = { width: 1440, height: 900 }, reducedMotion = false } = {}) {
  // A fresh context per scenario, so one scenario's cookie never leaks into the next.
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const closePage = page.close.bind(page)
  page.close = async () => {
    await closePage()
    await context.close()
  }
  const failures = []
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  await page.setViewport(viewport)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }])
  await page.evaluateOnNewDocument((fixedIso) => {
    const fixed = new Date(fixedIso).getTime()
    const RealDate = Date
    class PinnedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]))
      }

      static now() {
        return fixed
      }
    }
    globalThis.Date = PinnedDate
  }, iso)
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === baseUrl) return request.continue()
    return request.respond({ status: 200, contentType: request.resourceType() === 'fetch' ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: request.resourceType() === 'fetch' ? '{}' : '/* third-party script stubbed for the test */' })
  })
  const go = async (suffix = '') => {
    const response = await page.goto(`${baseUrl}${pathname}${suffix}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    assert.equal(response?.status(), 200)
    await page.waitForFunction(() => document.readyState !== 'loading')
  }
  const state = () => page.evaluate(() => {
    const moon = document.querySelector('.nx-spook-moon')
    const heading = [...document.querySelectorAll('h1')].find((h1) => h1.getBoundingClientRect().height > 0)
    return {
      on: document.documentElement.getAttribute('data-halloween') === 'on',
      switches: [...document.querySelectorAll('.nx-spook-switch')].map((control) => control.getAttribute('aria-pressed')),
      cookie: (/(?:^|;\s*)rn_halloween=(on|off)/.exec(document.cookie) || [])[1] || null,
      moonVisible: Boolean(moon && !moon.hidden && getComputedStyle(moon).display !== 'none'),
      moonClear: (() => {
        if (!moon || !heading) return true
        const a = moon.getBoundingClientRect()
        const b = heading.getBoundingClientRect()
        return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
      })(),
      bats: document.querySelectorAll('.nx-spook__bat').length,
      sheet: [...document.styleSheets].some((sheet) => /nx-halloween\.css$/.test(sheet.href || '') && sheet.cssRules.length > 0),
      spider: Boolean(document.querySelector('.nx-spook-spider')),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  return { page, failures, go, state }
}

async function checkHalloween(browser, baseUrl, pathname, label, { spiderPage = false } = {}) {
  // Mid-October: offered, off until the visitor turns it on, then remembered.
  {
    const { page, failures, go, state } = await halloweenPage(browser, baseUrl, pathname, { iso: '2026-10-11T12:00:00' })
    try {
      await go()
      let now = await state()
      assert.equal(now.on, false, `${label}: off by default before 24 October`)
      assert.deepEqual(now.switches, ['false', 'false'], `${label}: nav and footer switches`)
      await page.click('.nx-spook-switch--nav')
      await page.waitForFunction(() => document.documentElement.getAttribute('data-halloween') === 'on', { timeout: 5_000 })
      await page.waitForFunction(() => document.querySelector('.nx-spook-toast.is-on'), { timeout: 5_000 })
      now = await state()
      assert.deepEqual(now.switches, ['true', 'true'], `${label}: both switches follow`)
      assert.equal(now.cookie, 'on', `${label}: the choice is kept`)
      assert.equal(now.moonVisible, true, `${label}: the moon is up`)
      assert.equal(now.sheet, true, `${label}: the Halloween stylesheet is loaded`)
      assert.equal(now.moonClear, true, `${label}: the moon never sits behind the first heading`)
      assert.equal(now.bats, 4, `${label}: bats fly when motion is allowed`)
      assert.equal(now.overflow, false, `${label}: no horizontal overflow in Halloween mode`)
      if (spiderPage) {
        await page.waitForSelector('.nx-spook-spider.is-down', { timeout: 5_000 })
        await page.evaluate(() => document.querySelector('.nx-spook-spider__bob')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
        await page.waitForFunction(() => !document.querySelector('.nx-spook-spider'), { timeout: 5_000 })
      } else {
        assert.equal(now.spider, false, `${label}: no spider on working pages`)
      }
      await go()
      assert.equal((await state()).on, true, `${label}: on before first paint after a reload`)
      await page.click('.nx-spook-switch--foot')
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-halloween'), { timeout: 5_000 })
      assert.equal((await state()).cookie, 'off', `${label}: turning it off is kept too`)
      assert.deepEqual(failures, [], `${label}: Halloween browser failures`)
    } finally {
      await page.close()
    }
  }
  // Halloween week starts on; ?halloween=off still wins.
  {
    const { page, failures, go, state } = await halloweenPage(browser, baseUrl, pathname, { iso: '2026-10-29T20:00:00', viewport: { width: 390, height: 844, isMobile: true } })
    try {
      await go()
      let now = await state()
      assert.equal(now.on, true, `${label}: on by default in Halloween week`)
      assert.equal(now.overflow, false, `${label}: no phone overflow in Halloween mode`)
      assert.equal(now.moonClear, true, `${label}: the moon clears the heading on phones`)
      await go('?halloween=off')
      now = await state()
      assert.equal(now.on, false, `${label}: ?halloween=off turns it off`)
      assert.equal(now.cookie, 'off')
      assert.deepEqual(failures, [], `${label}: Halloween week browser failures`)
    } finally {
      await page.close()
    }
  }
  // Reduced motion: the theme without bats, spider or flicker.
  {
    const { page, failures, go, state } = await halloweenPage(browser, baseUrl, pathname, { iso: '2026-10-30T20:00:00', reducedMotion: true })
    try {
      await go()
      const now = await state()
      assert.equal(now.on, true)
      assert.equal(now.bats, 0, `${label}: no bats under reduced motion`)
      assert.equal(now.spider, false, `${label}: no spider under reduced motion`)
      await page.click('.nx-spook-switch--nav')
      assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-halloween') || Boolean(document.querySelector('.nx-spook-flash'))), false, `${label}: switches at once, no flicker`)
      assert.deepEqual(failures, [], `${label}: reduced-motion Halloween browser failures`)
    } finally {
      await page.close()
    }
  }
  // Out of season: nothing, unless previewed; a preview saves nothing.
  {
    const { page, failures, go, state } = await halloweenPage(browser, baseUrl, pathname, { iso: '2026-12-01T12:00:00' })
    try {
      await go()
      let now = await state()
      assert.equal(now.on, false, `${label}: off out of season`)
      assert.deepEqual(now.switches, [], `${label}: no switch out of season`)
      assert.equal(now.sheet, false, `${label}: no Halloween stylesheet out of season`)
      await go('?halloween=on')
      now = await state()
      assert.equal(now.on, true, `${label}: ?halloween=on previews out of season`)
      assert.equal(now.cookie, null, `${label}: a preview stores nothing`)
      assert.deepEqual(failures, [], `${label}: preview browser failures`)
    } finally {
      await page.close()
    }
  }
}

async function checkScreenshotsReveal(browser, baseUrl, pathname) {
  // The motion layer clips screenshots shut and wipes them open on entry; every
  // one of them has to end up visible once scrolled to (it once stayed clipped).
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1440, height: 900 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'load', timeout: 15_000 })
    const count = await page.evaluate(() => document.querySelectorAll('.screen-frame, .app-screen-shot, .ios-hero-shot').length)
    assert.ok(count > 0, `${pathname} has screenshots to check`)
    await page.evaluate(async () => {
      for (const frame of document.querySelectorAll('.screen-frame, .app-screen-shot, .ios-hero-shot')) {
        frame.scrollIntoView({ block: 'center' })
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 1_400))
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.screen-frame, .app-screen-shot, .ios-hero-shot')]
      .filter((frame) => getComputedStyle(frame).clipPath.includes('100%'))
      .map((frame) => frame.querySelector('img')?.getAttribute('src') || frame.className))
    assert.deepEqual(clipped, [], `${pathname} screenshots stayed clipped after scrolling into view`)
  } finally {
    await page.close()
  }
}

async function checkRuntimeMarkdownHeadingHierarchy(browser, baseUrl) {
  const page = await browser.newPage()
  const failures = []
  await page.evaluateOnNewDocument(() => {
    const thread = { id: 'markdown-heading-thread', title: 'Markdown heading regression', summary: '', last_message_at: '2026-08-22T00:00:00.000Z', created_at: '2026-08-22T00:00:00.000Z' }
    const message = { id: 'markdown-heading-message', role: 'assistant', content: '# Runtime **heading**\n\n## Nested <img src=x onerror=alert(1)>\n\n### Deep heading', created_at: '2026-08-22T00:00:00.000Z', provider: 'fixture', model: 'fixture' }
    const queryFor = (table) => {
      const result = { data: table === 'chat_threads' ? [thread] : [message], error: null }
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => Promise.resolve(result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      }
      return query
    }
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'fixture-token', user: { id: 'fixture-user', email: 'fixture@example.com' } } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: queryFor,
    }
    window.__ROACHNET_SUPABASE_AUTH_CLIENT__ = {
      supabaseUrl: 'https://fixture.supabase.co',
      supabaseAnonKey: 'fixture-anon-key',
      client,
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === baseUrl && url.pathname === '/site-config.js') {
      return request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: `window.__ROACHNET_SITE_CONFIG__ = { auth: { enabled: true, provider: 'supabase', supabaseUrl: 'https://fixture.supabase.co', supabaseAnonKey: 'fixture-anon-key' }, webChat: { enabled: true } }`,
      })
    }
    if (url.origin === baseUrl) return request.continue()
    return request.respond({ status: 200, contentType: request.resourceType() === 'fetch' ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: request.resourceType() === 'fetch' ? '{}' : '/* third-party script stubbed for the test */' })
  })
  try {
    const response = await page.goto(`${baseUrl}/roachclaw/`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    assert.equal(response?.status(), 200, 'RoachClaw Markdown fixture response')
    await page.waitForSelector('.rc-message__content', { timeout: 10_000 })
    const outcome = await page.evaluate(() => {
      const content = document.querySelector('.rc-message__content')
      const headings = [...content.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      return {
        headingTags: headings.map((heading) => heading.tagName),
        messageH1s: content.querySelectorAll('h1').length,
        unsafeElements: content.querySelectorAll('script, img, iframe, object, embed').length,
        nestedText: headings[1]?.textContent || '',
        headingStyles: headings.map((heading) => {
          const style = getComputedStyle(heading)
          return [style.fontSize, style.color, style.marginBlockStart, style.marginBlockEnd]
        }),
      }
    })
    assert.deepEqual(outcome.headingTags, ['H2', 'H3', 'H4'], 'runtime Markdown headings must start below the page h1')
    assert.equal(outcome.messageH1s, 0, 'runtime messages must not add a page-level h1')
    assert.equal(outcome.unsafeElements, 0, 'runtime Markdown headings must remain sanitized')
    assert.match(outcome.nestedText, /<img src=x onerror=alert\(1\)>/, 'escaped heading content must remain visible as text')
    assert.ok(outcome.headingStyles.every((style) => JSON.stringify(style) === JSON.stringify(outcome.headingStyles[0])), 'demoted runtime headings must preserve message heading styles')
    assert.deepEqual(failures, [], 'RoachClaw Markdown fixture browser failures')
  } finally {
    await page.close()
  }
}

async function checkAppDetailKeyboardFlow(browser, baseUrl) {
  const page = await browser.newPage()
  const failures = []
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  try {
    const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    assert.equal(response?.status(), 200, 'Apps catalog response')
    await page.waitForSelector('[data-preview-id]', { timeout: 15_000 })
    const triggers = await page.$$('[data-preview-id]')
    const triggerCandidates = await Promise.all(triggers.map(async (candidate) => ({
      candidate,
      visible: await candidate.isVisible(),
      selected: await candidate.evaluate((element) => element.closest('.apps-card')?.classList.contains('is-selected') || false),
    })))
    const trigger = triggerCandidates.find(({ visible, selected }) => visible && !selected)?.candidate
      || triggerCandidates.find(({ visible }) => visible)?.candidate
    assert.ok(trigger, 'Apps catalog needs a visible preview trigger')
    const triggerId = await trigger.evaluate((element) => element.getAttribute('data-preview-id'))
    await trigger.focus()
    await trigger.evaluate((element) => element.click())
    await page.waitForSelector('#apps-detail-overlay:not([hidden])', { timeout: 5_000 })
    await page.waitForFunction(() => document.activeElement?.id === 'apps-detail-close', { timeout: 5_000 })
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'apps-detail-close', 'Apps detail must move focus to its close control')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Tab')
    await page.keyboard.up('Shift')
    assert.equal(await page.evaluate(() => {
      const overlay = document.querySelector('#apps-detail-overlay')
      const focusable = [...overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element instanceof HTMLElement && element.getClientRects().length > 0)
      return document.activeElement === focusable.at(-1)
    }), true, 'Apps detail must reverse-tab to its final focusable control')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'apps-detail-close', 'Apps detail must cycle forward to its close control')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#apps-detail-overlay[hidden]', { timeout: 5_000 })
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-preview-id')), triggerId, 'Apps detail must return focus to its original trigger')
    assert.deepEqual(failures, [], 'Apps detail keyboard browser failures')
  } finally {
    await page.close()
  }
}

const browser = await puppeteer.launch({ executablePath: await findChromium(), headless: true, timeout: 60_000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
try {
  for (const site of sites) {
    const server = await startServer(path.join(root, site.directory), await sitePolicy(site))
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    try {
      for (const [pathname, expectedMime] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml']]) {
        const response = await fetch(`${baseUrl}${pathname}`)
        assert.equal(response.status, 200, `${site.name}${pathname} status`)
        assert.match(response.headers.get('content-type') || '', new RegExp(`^${expectedMime}`), `${site.name}${pathname} MIME type`)
      }
      const unknown = await fetch(`${baseUrl}/this-route-does-not-exist`)
      assert.equal(unknown.status, 404, `${site.name} unknown route must be a 404`)
      assert.match(await unknown.text(), /<h1[ >]/i, `${site.name} 404 document has no h1`)
      for (const [name, pathname] of site.pages) {
        await checkPage(browser, baseUrl, pathname, { width: 1440, height: 900 }, `${site.name} ${name} desktop`)
        await checkPage(browser, baseUrl, pathname, { width: 390, height: 844, isMobile: true }, `${site.name} ${name} mobile`)
        if (site.name === 'apps') {
          await checkPage(browser, baseUrl, pathname, { width: 320, height: 720, isMobile: true }, `${site.name} ${name} compact`)
        }
      }
      if (site.name === 'main') {
        await checkHalloween(browser, baseUrl, '/', 'main mission', { spiderPage: true })
        await checkHalloween(browser, baseUrl, '/home/', 'main home', { spiderPage: true })
        await checkHalloween(browser, baseUrl, '/roachclaw/', 'main roachclaw')
      } else {
        await checkHalloween(browser, baseUrl, '/', `${site.name} Halloween`)
      }
      if (site.name === 'main') {
        await checkRuntimeMarkdownHeadingHierarchy(browser, baseUrl)
        for (const pathname of ['/home/', '/ios/', '/brew/']) await checkScreenshotsReveal(browser, baseUrl, pathname)
      }
      if (site.name === 'apps') {
        await checkAppDetailKeyboardFlow(browser, baseUrl)
      }
    } finally {
      await close(server)
    }
  }
} finally {
  await browser.close()
}

console.log('Browser outcome checks passed for generated main, accounts, and apps sites')
