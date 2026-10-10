/* ==========================================================================
   RoachNet motion layer
   A second pass of micro-interactions layered on top of site-polish.js.

   Ground rules this file follows:
   - Never touch anything site-polish.js already owns (`.rn-cursor-light`,
     `.rn-click-ripple`, `[data-reveal]`, the nav indicator, scroll meter).
   - Everything is additive and opt-in: elements are tagged from here, so a
     failure in one module can't take the page down with it.
   - `prefers-reduced-motion: reduce` disables the whole layer.
   ========================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(pointer: fine)')
const smallScreen = window.matchMedia('(max-width: 720px)')

const root = document.documentElement
const body = document.body
const page = body?.dataset?.page || ''

/** Run a module in isolation — one broken effect shouldn't kill the rest. */
function safely(name, fn) {
  try {
    fn()
  } catch (error) {
    console.warn(`[motion-layer] ${name} skipped:`, error)
  }
}

function prefersReduced() {
  return reduceMotion.matches
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/* --------------------------------------------------------------------------
   Atmosphere: aurora wash + slow scan sweep
   -------------------------------------------------------------------------- */

function mountAtmosphere() {
  if (prefersReduced()) return

  const aurora = document.createElement('div')
  aurora.className = 'rnm-aurora'
  aurora.setAttribute('aria-hidden', 'true')
  aurora.innerHTML =
    '<span class="rnm-aurora__blob rnm-aurora__blob--a"></span>' +
    '<span class="rnm-aurora__blob rnm-aurora__blob--b"></span>' +
    '<span class="rnm-aurora__blob rnm-aurora__blob--c"></span>'
  body.prepend(aurora)

  if (!smallScreen.matches) {
    const scan = document.createElement('div')
    scan.className = 'rnm-scan'
    scan.setAttribute('aria-hidden', 'true')
    body.prepend(scan)
    requestAnimationFrame(() => scan.classList.add('is-rnm-lit'))
  }

  requestAnimationFrame(() => aurora.classList.add('is-rnm-lit'))
}

/* --------------------------------------------------------------------------
   Cursor companion — a spring-lagged ring that swells over anything clickable
   -------------------------------------------------------------------------- */

const TARGET_SELECTOR =
  'a, button, [role="button"], input, select, textarea, summary, [data-platform], [data-homebrew-install], [data-homebrew-copy]'

function mountCursor() {
  if (prefersReduced() || !finePointer.matches) return

  const ring = document.createElement('div')
  ring.className = 'rnm-cursor'
  ring.setAttribute('aria-hidden', 'true')
  ring.innerHTML = '<span class="rnm-cursor__dot"></span>'
  body.appendChild(ring)

  body.dataset.rnmPointer = 'fine'

  let targetX = window.innerWidth / 2
  let targetY = window.innerHeight / 2
  let x = targetX
  let y = targetY
  let running = false

  function frame() {
    // Critically-ish damped follow: fast enough to feel attached, slow
    // enough to read as a separate object.
    x += (targetX - x) * 0.18
    y += (targetY - y) * 0.18
    ring.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`

    if (Math.abs(targetX - x) > 0.1 || Math.abs(targetY - y) > 0.1) {
      requestAnimationFrame(frame)
    } else {
      running = false
    }
  }

  function kick() {
    if (running) return
    running = true
    requestAnimationFrame(frame)
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return
      targetX = event.clientX
      targetY = event.clientY
      ring.classList.add('is-rnm-lit')
      ring.classList.toggle('is-rnm-target', Boolean(event.target?.closest?.(TARGET_SELECTOR)))
      kick()
    },
    { passive: true }
  )

  window.addEventListener('pointerdown', () => ring.classList.add('is-rnm-press'), { passive: true })
  window.addEventListener('pointerup', () => ring.classList.remove('is-rnm-press'), { passive: true })
  document.addEventListener('mouseleave', () => ring.classList.remove('is-rnm-lit'))
  document.addEventListener('mouseenter', () => ring.classList.add('is-rnm-lit'))
}

/* --------------------------------------------------------------------------
   Reveal choreography
   Only elements WITHOUT the existing `data-reveal` attribute get tagged, so
   the two systems never fight over the same transform.
   -------------------------------------------------------------------------- */

const REVEAL_TARGETS = [
  ['.hero-copy > *', 'up'],
  ['.section-head > *', 'up'],
  ['.sitemap-card li', 'up'],
  ['.hero-signal-card', 'tilt'],
  ['.screen-chip', 'up'],
  ['.hero-links a', 'up'],
  ['.download-layout > *', 'tilt'],
  ['.downloads-actions > *', 'up'],
  ['.rc-starter-card', 'tilt'],
  ['.rc-info-strip__item', 'up'],
  ['.apps-store-sidebar__card > *', 'left'],
  ['.api-docs-sidebar__intro > *', 'left'],
  ['.site-footer__copy > *', 'up'],
]

function tagReveals() {
  const groups = new Map()

  REVEAL_TARGETS.forEach(([selector, direction]) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.hasAttribute('data-reveal') || node.hasAttribute('data-rnm-reveal')) return
      node.setAttribute('data-rnm-reveal', direction)

      const parent = node.parentElement || body
      const index = groups.get(parent) ?? 0
      node.style.setProperty('--rnm-i', String(Math.min(index, 9)))
      groups.set(parent, index + 1)
    })
  })
}

function observeReveals() {
  const nodes = Array.from(
    document.querySelectorAll('[data-rnm-reveal], .rnm-wipe, .rnm-split')
  ).filter((node) => node.dataset.rnmObserved !== 'on')

  if (!nodes.length) return
  nodes.forEach((node) => {
    node.dataset.rnmObserved = 'on'
  })

  if (prefersReduced() || typeof IntersectionObserver !== 'function') {
    nodes.forEach((node) => node.classList.add('is-rnm-in', 'is-rnm-settled'))
    return
  }

  // A wipe frame starts fully clipped, and Chrome won't report a fully clipped
  // element as intersecting, so wipes are watched through their parent instead.
  const watched = new Map()
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        for (const node of watched.get(entry.target) || [entry.target]) {
          node.classList.add('is-rnm-in')
          window.setTimeout(() => node.classList.add('is-rnm-settled'), 1400)
        }
        observer.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )

  nodes.forEach((node) => {
    const target = node.classList.contains('rnm-wipe') && node.parentElement ? node.parentElement : node
    watched.set(target, [...(watched.get(target) || []), node])
    observer.observe(target)
  })
}

/* --------------------------------------------------------------------------
   Headline cascade
   Split only headings that are a single plain text node, wrap words so lines
   still break correctly, and hand screen readers the original string.
   -------------------------------------------------------------------------- */

const SPLIT_SELECTOR = '.hero-copy h1, .section-head h2, .sitemap-hero h1, .rc-empty-state__heading'

function splitHeadings() {
  if (prefersReduced() || smallScreen.matches) return

  document.querySelectorAll(SPLIT_SELECTOR).forEach((heading) => {
    if (heading.dataset.rnmSplit === 'done') return
    if (heading.childNodes.length !== 1 || heading.firstChild.nodeType !== Node.TEXT_NODE) return

    const text = heading.textContent.trim()
    if (!text || text.length > 90) return

    const wrapper = document.createElement('span')
    wrapper.className = 'rnm-split'
    wrapper.setAttribute('aria-hidden', 'true')

    let charIndex = 0
    text.split(' ').forEach((word, wordIndex, words) => {
      const wordSpan = document.createElement('span')
      wordSpan.className = 'rnm-split__word'

      Array.from(word).forEach((char) => {
        const charSpan = document.createElement('span')
        charSpan.className = 'rnm-split__char'
        charSpan.style.setProperty('--rnm-i', String(charIndex))
        charSpan.textContent = char
        wordSpan.appendChild(charSpan)
        charIndex += 1
      })

      wrapper.appendChild(wordSpan)

      if (wordIndex < words.length - 1) {
        wrapper.appendChild(document.createTextNode(' '))
        charIndex += 1
      }
    })

    heading.setAttribute('aria-label', text)
    heading.textContent = ''
    heading.appendChild(wrapper)
    heading.dataset.rnmSplit = 'done'
    heading.classList.add('rnm-split-host')
  })
}

/* --------------------------------------------------------------------------
   Tilt cards — pointer-tracked 3D with a specular sheen and a traced edge
   -------------------------------------------------------------------------- */

const TILT_SELECTOR = [
  '.support-card',
  '.runtime-card',
  '.usecase-card',
  '.shelf-card',
  '.surface-card',
  '.feature-card',
  '.sitemap-card',
  '.ios-shot-card',
  '.ios-story-card',
  '.hero-signal-card',
  '.download-hero-card',
  '.download-side-card',
  '.apps-card',
  '.rc-starter-card',
  '.why-cap-card',
  '.landing-why__capability',
].join(', ')

function mountTilt() {
  if (prefersReduced() || !finePointer.matches || smallScreen.matches) return

  const cards = Array.from(document.querySelectorAll(TILT_SELECTOR))
  if (!cards.length) return

  cards.forEach((card) => {
    if (card.dataset.rnmTilt === 'on') return
    card.dataset.rnmTilt = 'on'
    card.classList.add('rnm-tilt')

    // The sheen and edge light are absolutely positioned pseudo-elements.
    if (getComputedStyle(card).position === 'static') {
      card.style.position = 'relative'
    }

    let frame = 0
    let rect = null

    function track(event) {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!rect) rect = card.getBoundingClientRect()
        if (!rect.width || !rect.height) return

        const px = (event.clientX - rect.left) / rect.width
        const py = (event.clientY - rect.top) / rect.height

        // Bigger cards get a shallower tilt so nothing looks warped.
        const strength = clamp(9 - rect.width / 260, 3.5, 9)

        card.style.setProperty('--rnm-ry', `${((px - 0.5) * strength).toFixed(2)}deg`)
        card.style.setProperty('--rnm-rx', `${((0.5 - py) * strength).toFixed(2)}deg`)
        card.style.setProperty('--rnm-px', `${(px * 100).toFixed(1)}%`)
        card.style.setProperty('--rnm-py', `${(py * 100).toFixed(1)}%`)
      })
    }

    card.addEventListener(
      'pointerenter',
      (event) => {
        if (event.pointerType !== 'mouse') return
        rect = card.getBoundingClientRect()
        card.classList.add('is-rnm-tracking')
        track(event)
      },
      { passive: true }
    )

    card.addEventListener('pointermove', track, { passive: true })

    card.addEventListener(
      'pointerleave',
      () => {
        rect = null
        if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
        card.classList.remove('is-rnm-tracking')
        card.style.removeProperty('--rnm-rx')
        card.style.removeProperty('--rnm-ry')
      },
      { passive: true }
    )
  })

  // Cached rects go stale the moment the layout moves.
  window.addEventListener(
    'scroll',
    () => {
      document.querySelectorAll('.rnm-tilt.is-rnm-tracking').forEach((card) => {
        card.classList.remove('is-rnm-tracking')
      })
    },
    { passive: true }
  )
}

/* --------------------------------------------------------------------------
   Buttons — shine sweep on hover, spring press, spark burst on click
   -------------------------------------------------------------------------- */

const SHINE_SELECTOR = '.cta, .apps-card__install, .rc-composer__send, .apps-store-sidebar__download'
const POP_SELECTOR =
  '.site-action-pill, .screen-chip, .apps-store-status-chip, .rc-auth-gate__chip, .site-header__status, .screen-version-chip'

const SPARK_COLORS = ['rgba(120, 220, 255, 0.95)', 'rgba(75, 255, 165, 0.9)', 'rgba(160, 190, 255, 0.9)']

function mountButtons() {
  if (prefersReduced()) return

  document.querySelectorAll(SHINE_SELECTOR).forEach((el) => {
    if (el.dataset.rnmShine === 'on') return
    el.dataset.rnmShine = 'on'
    el.classList.add('rnm-shine')

    el.addEventListener('pointerenter', () => el.classList.add('is-rnm-hover'), { passive: true })
    el.addEventListener(
      'pointerleave',
      () => el.classList.remove('is-rnm-hover', 'is-rnm-press'),
      { passive: true }
    )
    el.addEventListener('pointerdown', () => el.classList.add('is-rnm-press'), { passive: true })
    el.addEventListener('pointerup', () => el.classList.remove('is-rnm-press'), { passive: true })
  })

  document.querySelectorAll(POP_SELECTOR).forEach((el) => {
    if (el.dataset.rnmPop === 'on') return
    el.dataset.rnmPop = 'on'
    el.classList.add('rnm-pop')
    el.addEventListener('pointerenter', () => el.classList.add('is-rnm-hover'), { passive: true })
    el.addEventListener('pointerleave', () => el.classList.remove('is-rnm-hover'), { passive: true })
  })

  document.querySelectorAll('.site-footer__nav a, .hero-links a').forEach((el) => {
    if (el.dataset.rnmUnderline === 'on') return
    el.dataset.rnmUnderline = 'on'
    el.classList.add('rnm-underline')

    el.addEventListener(
      'pointerenter',
      (event) => {
        const rect = el.getBoundingClientRect()
        const origin = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 : 0
        el.style.setProperty('--rnm-origin', `${clamp(origin, 0, 100).toFixed(0)}%`)
        el.classList.add('is-rnm-hover')
      },
      { passive: true }
    )
    el.addEventListener('pointerleave', () => el.classList.remove('is-rnm-hover'), { passive: true })
  })

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (prefersReduced()) return
      const trigger = event.target?.closest?.(SHINE_SELECTOR)
      if (!trigger) return
      burst(event.clientX, event.clientY)
    },
    { passive: true }
  )
}

function burst(clientX, clientY) {
  const count = smallScreen.matches ? 6 : 12
  const fragment = document.createDocumentFragment()

  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement('span')
    spark.className = 'rnm-spark'

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const distance = 26 + Math.random() * 52

    spark.style.left = `${clientX}px`
    spark.style.top = `${clientY}px`
    spark.style.background = SPARK_COLORS[i % SPARK_COLORS.length]
    spark.style.setProperty('--rnm-sx1', `${(Math.cos(angle) * distance).toFixed(1)}px`)
    spark.style.setProperty('--rnm-sy1', `${(Math.sin(angle) * distance).toFixed(1)}px`)
    spark.style.setProperty('--rnm-spark-life', `${520 + Math.random() * 320}ms`)

    spark.addEventListener('animationend', () => spark.remove(), { once: true })
    fragment.appendChild(spark)
  }

  body.appendChild(fragment)
}

/* --------------------------------------------------------------------------
   Media — clip wipe on entry, gentle float on hero art
   -------------------------------------------------------------------------- */

const WIPE_SELECTOR = '.screen-frame, .app-screen-shot, .ios-hero-shot'

function mountMedia() {
  if (prefersReduced()) return

  document.querySelectorAll(WIPE_SELECTOR).forEach((frame) => {
    if (frame.dataset.rnmWipe === 'on') return
    frame.dataset.rnmWipe = 'on'
    frame.classList.add('rnm-wipe')
  })

  if (!smallScreen.matches) {
    document.querySelectorAll('.hero-visual .screen-frame--hero, .ios-hero-visual .ios-hero-shot').forEach((el) => {
      el.classList.add('rnm-float')
    })
  }

  // The wipe starts clipped shut, so every frame tagged here has to be watched.
  // (boot() runs the reveal observer before this module; without this call the
  // screenshots stayed clipped forever.)
  observeReveals()
}

/* --------------------------------------------------------------------------
   Status dots — a slow halo so "live" actually reads as live
   -------------------------------------------------------------------------- */

function mountPulses() {
  if (prefersReduced()) return
  document
    .querySelectorAll('.rc-lane-dot--web, .hero-status__pill[data-state="online"]')
    .forEach((el) => el.classList.add('rnm-pulse'))
}

/* --------------------------------------------------------------------------
   Scroll kinetics — velocity variable, heading gradient sweep, section skew
   -------------------------------------------------------------------------- */

function mountScrollKinetics() {
  if (prefersReduced()) return

  const sweepTargets = Array.from(document.querySelectorAll('.section-head h2')).filter((el) => {
    // Never hijack a heading that already paints itself with a gradient.
    const styles = getComputedStyle(el)
    return styles.backgroundImage === 'none' && styles.webkitTextFillColor !== 'rgba(0, 0, 0, 0)'
  })

  sweepTargets.forEach((el) => el.classList.add('rnm-gradient-text'))

  document.querySelectorAll('.card-grid, .runtime-grid, .usecase-grid, .shelf-grid, .sitemap-grid').forEach((el) => {
    el.classList.add('rnm-kinetic')
  })

  let lastY = window.scrollY
  let velocity = 0
  let ticking = false

  function update() {
    ticking = false

    const y = window.scrollY
    const delta = y - lastY
    lastY = y
    velocity += (delta - velocity) * 0.25
    const clamped = clamp(velocity / 26, -1, 1)

    root.style.setProperty('--rnm-vel', clamped.toFixed(3))
    root.style.setProperty('--rnm-vel-abs', Math.abs(clamped).toFixed(3))

    const viewport = window.innerHeight || 1
    sweepTargets.forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.bottom < -200 || rect.top > viewport + 200) return
      const progress = clamp(1 - (rect.top + rect.height / 2) / viewport, 0, 1)
      el.style.setProperty('--rnm-sweep', progress.toFixed(3))
    })
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    },
    { passive: true }
  )

  update()
}

/* --------------------------------------------------------------------------
   Page veil — a short curtain when leaving for another RoachNet page
   -------------------------------------------------------------------------- */

const ROACHNET_HOSTS = new Set([
  'roachnet.org',
  'www.roachnet.org',
  'apps.roachnet.org',
  'accounts.roachnet.org',
  window.location.host,
])

const FILE_LIKE = /\.(dmg|ipa|zip|pkg|json|png|jpg|jpeg|webp|svg|txt|xml|ico)$/i

function mountVeil() {
  if (prefersReduced()) return

  const veil = document.createElement('div')
  veil.className = 'rnm-veil is-rnm-clear'
  veil.setAttribute('aria-hidden', 'true')
  veil.innerHTML = '<span class="rnm-veil__mark"></span>'
  body.appendChild(veil)

  // Coming back through the bfcache must never leave the curtain drawn.
  window.addEventListener('pageshow', () => {
    veil.classList.add('is-rnm-clear')
    veil.classList.remove('is-rnm-leaving')
  })

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const link = event.target?.closest?.('a[href]')
    if (!link) return
    if (link.target && link.target !== '_self') return
    if (link.hasAttribute('download')) return

    let url
    try {
      url = new URL(link.getAttribute('href'), window.location.href)
    } catch {
      return
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    if (!ROACHNET_HOSTS.has(url.host)) return
    if (FILE_LIKE.test(url.pathname)) return
    // In-page anchors are not navigations.
    if (url.pathname === window.location.pathname && url.hash) return

    event.preventDefault()
    veil.classList.remove('is-rnm-clear')
    veil.classList.add('is-rnm-leaving')

    // Navigate on the animation, with a hard fallback if it never fires.
    let navigated = false
    const go = () => {
      if (navigated) return
      navigated = true
      window.location.href = url.href
    }

    veil.addEventListener('transitionend', (transition) => {
      // Child transitions bubble; only the curtain itself means "covered".
      if (transition.target === veil) go()
    })
    window.setTimeout(go, 420)
  })
}

/* --------------------------------------------------------------------------
   Late arrivals — the Apps and API pages render their content from JS,
   so re-tag whenever the main stage changes.
   -------------------------------------------------------------------------- */

function watchDynamicContent() {
  const stages = ['#apps-store-stage', '#api-route-list', '#api-detail-pane', '#roachclaw-log']
    .map((selector) => document.querySelector(selector))
    .filter(Boolean)

  if (!stages.length || typeof MutationObserver !== 'function') return

  let pending = 0
  const observer = new MutationObserver(() => {
    if (pending) return
    pending = window.setTimeout(() => {
      pending = 0
      safely('tilt:rescan', mountTilt)
      safely('buttons:rescan', mountButtons)
      safely('media:rescan', mountMedia)
      safely('reveal:rescan', () => {
        tagReveals()
        observeReveals()
      })
    }, 140)
  })

  stages.forEach((stage) => observer.observe(stage, { childList: true, subtree: true }))
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

function boot() {
  if (!body) return

  body.dataset.rnmMotion = prefersReduced() ? 'reduced' : 'full'

  safely('atmosphere', mountAtmosphere)
  safely('cursor', mountCursor)
  safely('headings', splitHeadings)
  safely('reveal', () => {
    tagReveals()
    observeReveals()
  })
  safely('tilt', mountTilt)
  safely('buttons', mountButtons)
  safely('media', mountMedia)
  safely('pulses', mountPulses)
  safely('scroll', mountScrollKinetics)
  safely('veil', mountVeil)
  safely('dynamic', watchDynamicContent)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}

// Someone flipping the OS motion switch mid-session should see it take effect.
reduceMotion.addEventListener?.('change', () => {
  if (!prefersReduced()) return
  document.querySelectorAll('.rnm-aurora, .rnm-scan, .rnm-cursor, .rnm-veil, .rnm-spark').forEach((el) => el.remove())
  document.querySelectorAll('[data-rnm-reveal], .rnm-wipe, .rnm-split').forEach((el) => {
    el.classList.add('is-rnm-in', 'is-rnm-settled')
  })
  body.dataset.rnmMotion = 'reduced'
})

// The landing page keeps its own bespoke canvas work; this flag lets that
// script know a second motion layer is present if it ever needs to back off.
window.__ROACHNET_MOTION_LAYER__ = { version: 1, page, reduced: prefersReduced() }
