// RoachNet site system v5 — shared behaviour for the nx chrome.
// Progressive: every effect checks reduced motion and pointer type first,
// nothing here is required for the page to work, and nothing runs inline
// (the CSP has no 'unsafe-inline').

const root = document.documentElement
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(pointer: fine)')
const motionOK = () => !reduced.matches
const pointerOK = () => finePointer.matches && motionOK()

function safely(name, fn) {
  try {
    fn()
  } catch (error) {
    console.warn(`[nx] ${name} skipped:`, error)
  }
}

/* Nav: scrolled state, gliding current-pill indicator, mobile menu. */
function mountNav() {
  const nav = document.querySelector('.nx-nav')
  if (!nav) return
  const links = nav.querySelector('.nx-nav__links')
  const burger = nav.querySelector('.nx-nav__burger')
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      nav.classList.toggle('is-scrolled', window.scrollY > 24)
      ticking = false
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  if (burger && links) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open)
      burger.setAttribute('aria-expanded', String(open))
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
    }
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')))
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false)
        burger.focus()
      }
    })
    nav.querySelectorAll('.nx-nav__link, .nx-nav__ghost, .nx-nav__cta').forEach((link) => {
      link.addEventListener('click', () => setOpen(false))
    })
  }

  if (!links || !pointerOK()) return
  const indicator = document.createElement('span')
  indicator.className = 'nx-nav__ind'
  indicator.setAttribute('aria-hidden', 'true')
  links.prepend(indicator)
  const current = links.querySelector('.nx-nav__link.is-current')
  const place = (target) => {
    if (!target) {
      indicator.style.width = '0'
      links.classList.remove('has-ind')
      return
    }
    const bounds = links.getBoundingClientRect()
    const box = target.getBoundingClientRect()
    indicator.style.width = `${box.width}px`
    indicator.style.transform = `translateX(${box.left - bounds.left}px)`
    links.classList.add('has-ind')
  }
  place(current)
  links.querySelectorAll('.nx-nav__link').forEach((link) => {
    link.addEventListener('pointerenter', () => place(link))
    link.addEventListener('focus', () => place(link))
  })
  links.addEventListener('pointerleave', () => place(current))
  links.addEventListener('focusout', (event) => {
    if (!links.contains(event.relatedTarget)) place(current)
  })
  window.addEventListener('resize', () => place(current))
}

/* Scroll progress hairline. */
function mountProgress() {
  const bar = document.querySelector('.nx-progress')
  if (!bar) return
  let ticking = false
  const update = () => {
    const max = root.scrollHeight - window.innerHeight
    root.style.setProperty('--nx-progress', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0')
    ticking = false
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }, { passive: true })
  update()
}

/* Pointer light + optional tilt on cards and screenshot frames. */
function mountPointerLight() {
  if (!pointerOK()) return
  const targets = document.querySelectorAll('.nx-card, .nx-screen, .nx-band')
  targets.forEach((element) => {
    const tilt = element.classList.contains('nx-card--tilt') || element.classList.contains('nx-screen')
    element.addEventListener('pointermove', (event) => {
      const box = element.getBoundingClientRect()
      const x = (event.clientX - box.left) / box.width
      const y = (event.clientY - box.top) / box.height
      element.style.setProperty('--nx-mx', `${(x * 100).toFixed(1)}%`)
      element.style.setProperty('--nx-my', `${(y * 100).toFixed(1)}%`)
      if (tilt) {
        element.style.setProperty('--nx-ry', `${((x - 0.5) * 6).toFixed(2)}deg`)
        element.style.setProperty('--nx-rx', `${((0.5 - y) * 6).toFixed(2)}deg`)
      }
    })
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--nx-mx', '50%')
      element.style.setProperty('--nx-my', '50%')
      element.style.setProperty('--nx-rx', '0deg')
      element.style.setProperty('--nx-ry', '0deg')
    })
  })
}

/* Magnetic primary buttons: the button leans toward the pointer, never more than 6px. */
function mountMagnets() {
  if (!pointerOK()) return
  document.querySelectorAll('.nx-btn--primary, .nx-btn--signal').forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      const box = button.getBoundingClientRect()
      const x = (event.clientX - (box.left + box.width / 2)) / (box.width / 2)
      const y = (event.clientY - (box.top + box.height / 2)) / (box.height / 2)
      button.style.setProperty('--nx-magnet-x', `${(x * 6).toFixed(1)}px`)
      button.style.setProperty('--nx-magnet-y', `${(y * 4).toFixed(1)}px`)
    })
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--nx-magnet-x', '0px')
      button.style.setProperty('--nx-magnet-y', '0px')
    })
  })
}

/* Reveal on entry. Elements inside a group stagger via --i. */
function mountReveals() {
  const items = document.querySelectorAll('[data-reveal], .nx-reveal')
  if (!items.length) return
  if (!('IntersectionObserver' in window) || !motionOK()) {
    root.classList.add('nx-no-observer')
    items.forEach((item) => item.classList.add('is-in'))
    return
  }
  document.querySelectorAll('.nx-grid, .nx-steps, .nx-stats').forEach((group) => {
    ;[...group.children].forEach((child, index) => child.style.setProperty('--i', String(index)))
  })
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      }
    })
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  items.forEach((item) => observer.observe(item))
  // Anything already past the fold when the observer starts (restored scroll)
  // is revealed on the next frame so nothing stays blank.
  requestAnimationFrame(() => {
    items.forEach((item) => {
      const box = item.getBoundingClientRect()
      if (box.top < window.innerHeight && box.bottom > 0) item.classList.add('is-in')
    })
  })
}

/* Count-up readouts: <span data-count="376" data-suffix=" MB">376 MB</span>. */
function mountCounters() {
  const counters = document.querySelectorAll('[data-count]')
  if (!counters.length || !motionOK() || !('IntersectionObserver' in window)) return
  const run = (element) => {
    const target = Number.parseFloat(element.dataset.count)
    if (!Number.isFinite(target)) return
    const decimals = (element.dataset.count.split('.')[1] || '').length
    const suffix = element.dataset.suffix || ''
    const prefix = element.dataset.prefix || ''
    const start = performance.now()
    const duration = 1100
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      element.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        run(entry.target)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.4 })
  counters.forEach((counter) => observer.observe(counter))
}

/* Copy buttons: <button data-nx-copy="text">…</button> or data-nx-copy-target="#id". */
let toast
function showToast(message) {
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'nx-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.append(toast)
  }
  toast.textContent = message
  toast.classList.add('is-on')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => toast.classList.remove('is-on'), 2200)
}

function mountCopy() {
  document.querySelectorAll('[data-nx-copy], [data-nx-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = button.dataset.nxCopyTarget ? document.querySelector(button.dataset.nxCopyTarget) : null
      const text = target ? target.textContent.trim() : button.dataset.nxCopy
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        showToast(button.dataset.nxCopied || 'Copied to your clipboard')
      } catch {
        showToast('Select the text and copy it by hand')
      }
    })
  })
}

/* Typed console lines: <span class="nx-console__line" data-type>brew install …</span>. */
function mountTyping() {
  const lines = document.querySelectorAll('[data-type]')
  if (!lines.length) return
  if (!motionOK() || !('IntersectionObserver' in window)) return
  const type = (line) => {
    const full = line.textContent
    line.textContent = ''
    line.classList.add('is-typing')
    let index = 0
    const step = () => {
      index += 1
      line.textContent = full.slice(0, index)
      if (index < full.length) {
        setTimeout(step, 18 + Math.random() * 30)
      } else {
        setTimeout(() => line.classList.remove('is-typing'), 1400)
      }
    }
    setTimeout(step, 240)
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        type(entry.target)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.5 })
  lines.forEach((line) => observer.observe(line))
}

/* Ticker: duplicate the track once so the loop is seamless. */
function mountTicker() {
  document.querySelectorAll('.nx-ticker__track').forEach((track) => {
    if (track.dataset.cloned) return
    track.dataset.cloned = '1'
    track.append(...[...track.children].map((child) => {
      const clone = child.cloneNode(true)
      clone.setAttribute('aria-hidden', 'true')
      return clone
    }))
  })
}

/* Cursor ring on fine pointers. */
function mountCursor() {
  if (!pointerOK()) return
  const ring = document.createElement('div')
  ring.className = 'nx-cursor'
  ring.setAttribute('aria-hidden', 'true')
  document.body.append(ring)
  let shown = false
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    root.style.setProperty('--nx-cx', `${event.clientX}px`)
    root.style.setProperty('--nx-cy', `${event.clientY}px`)
    if (!shown) {
      shown = true
      root.classList.add('nx-cursor-on')
    }
    const hot = event.target instanceof Element && event.target.closest('a, button, [role="button"], input, select, textarea, summary')
    ring.classList.toggle('is-hot', Boolean(hot))
  }, { passive: true })
  document.addEventListener('pointerleave', () => root.classList.remove('nx-cursor-on'))
  document.addEventListener('pointerenter', () => { if (shown) root.classList.add('nx-cursor-on') })
}

/* Keycap shortcut hints light up when the real keys are held. */
function mountKeys() {
  const keys = document.querySelectorAll('.nx-key[data-key]')
  if (!keys.length) return
  const sync = (event) => {
    keys.forEach((key) => {
      const name = key.dataset.key
      const down = (name === 'shift' && event.shiftKey) || (name === 'meta' && (event.metaKey || event.ctrlKey)) || (name === event.key?.toLowerCase() && event.type === 'keydown')
      key.classList.toggle('is-down', Boolean(down))
    })
  }
  document.addEventListener('keydown', sync)
  document.addEventListener('keyup', (event) => {
    keys.forEach((key) => {
      const name = key.dataset.key
      if ((name === 'shift' && !event.shiftKey) || (name === 'meta' && !(event.metaKey || event.ctrlKey)) || name === event.key?.toLowerCase()) key.classList.remove('is-down')
    })
  })
}

/* Live status chips: time, connectivity. app.js owns the richer telemetry on Home;
   this only fills chips that nothing else manages. */
function mountStatusChips() {
  const chips = document.querySelectorAll('[data-nx-status]')
  if (!chips.length) return
  const update = () => {
    chips.forEach((chip) => {
      const kind = chip.dataset.nxStatus
      if (kind === 'time') {
        chip.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      } else if (kind === 'net') {
        const online = navigator.onLine
        chip.textContent = online ? 'Online now' : 'Offline, and fine'
        chip.dataset.state = online ? 'online' : 'offline'
      }
    })
  }
  update()
  setInterval(update, 30_000)
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
}

function boot() {
  safely('nav', mountNav)
  safely('progress', mountProgress)
  safely('pointer-light', mountPointerLight)
  safely('magnets', mountMagnets)
  safely('reveals', mountReveals)
  safely('counters', mountCounters)
  safely('copy', mountCopy)
  safely('typing', mountTyping)
  safely('ticker', mountTicker)
  safely('cursor', mountCursor)
  safely('keys', mountKeys)
  safely('status', mountStatusChips)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
