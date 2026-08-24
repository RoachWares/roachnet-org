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
  {
    name: 'main',
    directoryName: 'website-main-dist',
    pages: [
      ['mission', '/'],
      ['home', '/home/'],
      ['ios', '/ios/'],
      ['api', '/api/'],
      ['brew', '/brew/'],
      ['sitemap', '/sitemap/'],
      ['roachclaw', '/roachclaw/'],
    ],
  },
  { name: 'accounts', directoryName: 'website-accounts-dist', pages: [['account', '/']] },
  { name: 'apps', directoryName: 'website-apps-dist', pages: [['catalog', '/']] },
]

async function findChromium() {
  const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH].filter(Boolean)
  try {
    const entries = await readdir('/opt/data/pw-browsers', { withFileTypes: true })
    for (const entry of entries.filter((item) => item.isDirectory() && item.name.startsWith('chromium-')).sort((a, b) => b.name.localeCompare(a.name))) {
      candidates.push(path.join('/opt/data/pw-browsers', entry.name, 'chrome-linux', 'chrome'))
      candidates.push(path.join('/opt/data/pw-browsers', entry.name, 'chrome-linux64', 'chrome'))
    }
  } catch {
    // The company browser cache is optional outside the verification image.
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
  throw new Error('No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install the company browser cache.')
}
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'], ['.webp', 'image/webp'], ['.xml', 'application/xml; charset=utf-8'],
])

function contentType(file) {
  return mime.get(path.extname(file)) || 'application/octet-stream'
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
    const url = new URL(request.url, 'http://localhost')
    const file = await localFile(directory, url.pathname)
    const fallback = path.join(directory, '404.html')
    const target = file || fallback
    response.writeHead(file ? 200 : 404, { 'content-type': contentType(target), 'cache-control': 'no-store' })
    createReadStream(target).pipe(response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function checkPage(browser, baseUrl, pathName, viewport, label) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  const failures = []
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === baseUrl) return request.continue()
    const isFetch = request.resourceType() === 'fetch'
    return request.respond({ status: 200, contentType: isFetch ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: isFetch ? '{}' : 'export {}' })
  })
  const response = await page.goto(`${baseUrl}${pathName}`, { waitUntil: 'domcontentloaded' })
  assert.equal(response.status(), 200, `${label} home response`)
  await page.waitForFunction(() => document.querySelector('h1'), { timeout: 10_000 })
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  const outcome = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const targets = [...document.querySelectorAll('a, button, input, select, textarea')].filter((target) => visible(target) && !target.closest('footer'))
    return {
      bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
      h1s: [...document.querySelectorAll('h1')].filter(visible).length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      smallTargets: targets.filter((target) => {
        const rect = target.getBoundingClientRect()
        return rect.width < 24 && rect.height < 24
      }).map((target) => target.outerHTML.slice(0, 120)),
      hasSkip: Boolean(document.querySelector('.rn-skip-link')),
    }
  })
  assert.ok(outcome.bodySize >= 16, `${label} body font is below 16px`)
  assert.equal(outcome.h1s, 1, `${label} must expose one h1`)
  assert.equal(outcome.overflow, false, `${label} has horizontal overflow`)
  assert.deepEqual(outcome.smallTargets, [], `${label} has targets below 24px`)
  assert.equal(outcome.hasSkip, true, `${label} has no keyboard bypass link`)
  await page.evaluate(() => document.querySelector('.rn-skip-link').focus())
  assert.equal(await page.evaluate(() => document.activeElement?.matches('.rn-skip-link')), true, `${label} bypass link cannot receive keyboard focus`)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.matches('main, [role="main"]'))
  assert.equal(await page.evaluate(() => document.activeElement?.matches('main, [role="main"]')), true, `${label} skip link does not focus main content`)
  assert.deepEqual(failures, [], `${label} browser failures`)
  await page.close()
}

const chromium = await findChromium()
const browser = await puppeteer.launch({
  executablePath: chromium,
  headless: true,
  timeout: 60_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
try {
  for (const { name, directoryName, pages } of sites) {
    const directory = path.join(root, directoryName)
    const server = await startServer(directory)
    const { port } = server.address()
    const baseUrl = `http://127.0.0.1:${port}`
    try {
      for (const [pathName, expected] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml']]) {
        const response = await fetch(`${baseUrl}${pathName}`)
        assert.equal(response.status, 200, `${name}${pathName} status`)
        assert.match(response.headers.get('content-type'), new RegExp(`^${expected}`), `${name}${pathName} MIME type`)
      }
      const unknown = await fetch(`${baseUrl}/this-route-does-not-exist`)
      assert.equal(unknown.status, 404, `${name} unknown route must be a 404`)
      assert.match(await unknown.text(), /<h1[ >]/i, `${name} 404 document has no h1`)
      for (const [pageName, pathName] of pages) {
        await checkPage(browser, baseUrl, pathName, { width: 1440, height: 900 }, `${name} ${pageName} desktop`)
        await checkPage(browser, baseUrl, pathName, { width: 390, height: 844, isMobile: true }, `${name} ${pageName} mobile`)
      }
    } finally {
      await close(server)
    }
  }
} finally {
  await browser.close()
}

console.log('Browser outcome checks passed for 9 generated pages across main, accounts, and apps sites')
