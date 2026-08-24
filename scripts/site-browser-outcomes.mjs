#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
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

async function startServer(directory) {
  const server = http.createServer(async (request, response) => {
    const file = await localFile(directory, new URL(request.url, 'http://localhost').pathname)
    const target = file || path.join(directory, '404.html')
    response.writeHead(file ? 200 : 404, { 'content-type': mime.get(path.extname(target)) || 'application/octet-stream', 'cache-control': 'no-store' })
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
    return request.respond({ status: 200, contentType: request.resourceType() === 'fetch' ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: request.resourceType() === 'fetch' ? '{}' : 'export {}' })
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
    return request.respond({ status: 200, contentType: request.resourceType() === 'fetch' ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: request.resourceType() === 'fetch' ? '{}' : 'export {}' })
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

const browser = await puppeteer.launch({ executablePath: await findChromium(), headless: true, timeout: 60_000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
try {
  for (const site of sites) {
    const server = await startServer(path.join(root, site.directory))
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
        await checkRuntimeMarkdownHeadingHierarchy(browser, baseUrl)
      }
    } finally {
      await close(server)
    }
  }
} finally {
  await browser.close()
}

console.log('Browser outcome checks passed for generated main, accounts, and apps sites')
