const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function initInputModality() {
  document.addEventListener(
    'keydown',
    (event) => {
      const keyboardIntentKeys = ['Tab', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End']
      if (keyboardIntentKeys.includes(event.key)) {
        document.body.classList.add('is-keyboard-user')
      }
    },
    true
  )

  document.addEventListener(
    'pointerdown',
    () => {
      document.body.classList.remove('is-keyboard-user')
    },
    true
  )
}

function ensurePointerLight() {
  if (reduceMotion.matches || document.querySelector('.rn-cursor-light')) {
    return
  }

  const light = document.createElement('div')
  light.className = 'rn-cursor-light'
  light.setAttribute('aria-hidden', 'true')
  document.body.appendChild(light)
}

function initSkipLink() {
  if (document.querySelector('.rn-skip-link')) {
    return
  }

  const target = document.querySelector('main[id], main, [role="main"]')
  if (!target) {
    return
  }

  if (!target.id) {
    target.id = 'main'
  }

  const link = document.createElement('a')
  link.className = 'rn-skip-link'
  link.href = `#${target.id}`
  link.textContent = 'Skip the chrome'
  document.body.prepend(link)
}

function initReadingProgress() {
  if (document.body?.dataset.page === 'landing' || document.querySelector('.rn-scroll-meter')) {
    return
  }

  const meter = document.createElement('div')
  meter.className = 'rn-scroll-meter'
  meter.setAttribute('aria-hidden', 'true')
  document.body.appendChild(meter)

  const sync = () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollable))
    meter.style.setProperty('--rn-scroll-progress', `${(progress * 100).toFixed(2)}%`)
  }

  sync()
  window.addEventListener('scroll', sync, { passive: true })
  window.addEventListener('resize', sync, { passive: true })
}

function initDitherField() {
  if (document.body?.dataset.page === 'landing') {
    return
  }

  if (document.querySelector('.rn-dither-field')) {
    return
  }

  const shell = document.createElement('div')
  shell.className = 'rn-dither-field'
  shell.setAttribute('aria-hidden', 'true')

  const canvas = document.createElement('canvas')
  shell.appendChild(canvas)
  document.body.prepend(shell)

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
  if (!ctx) {
    shell.remove()
    return
  }

  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ].map((row) => row.map((value) => value / 16))
  const signals = [
    [0.12, 0.18, 0.82, 0.78, 0],
    [0.44, 0.24, 0.95, 0.58, 1],
    [0.78, 0.16, 0.7, 0.5, 1],
    [0.66, 0.58, 0.56, 0.66, 2],
    [0.25, 0.78, 0.46, 0.84, 0],
    [0.91, 0.84, 0.36, 0.72, 1],
    [0.52, 0.08, 0.74, 0.42, 2],
    [0.08, 0.62, 0.4, 0.72, 1],
  ]

  let width = 0
  let height = 0
  let cols = 0
  let rows = 0
  let pointerX = 0.5
  let pointerY = 0.24
  let smoothX = 0.5
  let smoothY = 0.24
  let frame = 0
  let start = performance.now()
  let lastDraw = 0
  let needsDraw = true

  function resize() {
    width = window.innerWidth || 1
    height = window.innerHeight || 1
    const constrainedDevice =
      navigator.hardwareConcurrency <= 4 ||
      (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4)
    const scale = width <= 420 ? (constrainedDevice ? 16 : 14) : width < 720 ? (constrainedDevice ? 14 : 12) : width > 1680 ? 8 : 7
    cols = Math.max(1, Math.ceil(width / scale))
    rows = Math.max(1, Math.ceil(height / scale))
    canvas.width = cols
    canvas.height = rows
    needsDraw = true
  }

  const hash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
    return value - Math.floor(value)
  }
  const clamp01 = (value) => Math.max(0, Math.min(1, value))
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0))
    return t * t * (3 - 2 * t)
  }
  const valueNoise = (x, y) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy)
    const b = hash(ix + 1, iy)
    const c = hash(ix, iy + 1)
    const d = hash(ix + 1, iy + 1)
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
  }
  const fbm = (x, y) => {
    let value = 0
    let amplitude = 0.5
    let frequency = 1
    for (let octave = 0; octave < 4; octave += 1) {
      value += valueNoise(x * frequency, y * frequency) * amplitude
      frequency *= 2.04
      amplitude *= 0.52
    }
    return value
  }

  function draw(now = performance.now()) {
    if (document.visibilityState === 'hidden') {
      frame = 0
      return
    }

    const frameBudget = width > 1900 ? 48 : width > 1200 ? 40 : 44
    if (!reduceMotion.matches && lastDraw && now - lastDraw < frameBudget) {
      frame = window.requestAnimationFrame(draw)
      return
    }

    lastDraw = now
    const time = reduceMotion.matches ? 0 : (now - start) / 1000
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const scroll = Math.min(1, Math.max(0, window.scrollY / scrollable))
    smoothX += (pointerX - smoothX) * 0.08
    smoothY += (pointerY - smoothY) * 0.08

    const cx = smoothX * 0.62 + 0.19
    const cy = smoothY * 0.48 + 0.15
    const scrollParallax = scroll * 0.18
    const aspect = width / Math.max(height, 1)
    const rayOriginX = 0.5 + (smoothX - 0.5) * 0.18
    const rayOriginY = -0.16 + smoothY * 0.16
    const image = ctx.createImageData(cols, rows)
    const data = image.data

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const px = x / cols
        const py = y / rows
        const ax = (px - 0.5) * aspect + 0.5
        const dx = px - cx
        const dy = py - cy + scrollParallax
        const radius = Math.sqrt(dx * dx + dy * dy)
        const horizon = Math.max(0, 1 - Math.abs(py - 0.3 - scroll * 0.09) * 2.75)
        const vanishing = Math.max(0, 1 - Math.abs(px - 0.5) * 1.42)
        const noiseA = fbm(px * 3.15 + time * 0.035 + scroll * 0.72, py * 3.8 - time * 0.028 + smoothY * 0.62)
        const noiseB = fbm(px * 7.2 - time * 0.055 + smoothX, py * 5.4 + time * 0.04 + scroll * 0.9)
        const tunnel = Math.sin(radius * 62 - time * 2.05 + scroll * 14.5 + noiseA * 2.1)
        const ring = Math.cos(radius * 96 - time * 1.18 + scroll * 10.5 + noiseB * 3.6)
        const drift = Math.sin(px * 13.6 + py * 8.8 + time * 0.5 + scroll * 4.9 + noiseA * 2.4)
        const contour = Math.cos((px - py) * 27 - time * 0.38 + scroll * 2.4)
        const lattice = Math.sin((px + smoothX * 0.3) * 47) * Math.cos((py - smoothY * 0.18) * 31)
        const rayDx = (ax - rayOriginX) * 1.12
        const rayDy = py - rayOriginY
        const rayDistance = Math.sqrt(rayDx * rayDx + rayDy * rayDy)
        const rayAngle = Math.atan2(rayDy, rayDx)
        const rayNoise = fbm(rayAngle * 2.1 + time * 0.05, rayDistance * 5.8 - time * 0.12 + scroll)
        const rayStripe = Math.max(0, Math.sin(rayAngle * 17 + rayNoise * 5.2 + time * 0.34 + scroll * 2.2))
        const godRay = smoothstep(0.46, 0.96, rayStripe + rayNoise * 0.42) * Math.pow(Math.max(0, 1 - rayDistance * 0.8), 2.1)
        const hexA = Math.abs(Math.sin((ax * 9.1 + py * 3.35 + scroll * 0.8 + time * 0.05) * Math.PI))
        const hexB = Math.abs(Math.sin((ax * -4.55 + py * 8.55 - scroll * 0.55 + time * 0.04) * Math.PI))
        const hexC = Math.abs(Math.sin((ax * 4.55 + py * 8.55 + smoothX * 0.5 - time * 0.045) * Math.PI))
        const hexGrid = Math.max(0, 1 - Math.min(hexA, hexB, hexC) * 15) * (0.42 + noiseB * 0.74)
        const plasma = Math.sin((noiseA * 5.8 + noiseB * 3.4 + px * 3.1 - py * 2.6 + time * 0.21 + scroll * 1.5) * Math.PI)
        const scanBand = Math.max(0, 1 - Math.abs(py - (0.14 + scroll * 0.38)) * 7.8)
        const wireA = Math.max(0, 1 - Math.abs(Math.sin((px * 2.35 + py * 1.42 + scroll * 0.74) * Math.PI * 8 + time * 0.28)) * 13)
        const wireB = Math.max(0, 1 - Math.abs(Math.sin((px * -1.25 + py * 2.1 + scroll * 0.46) * Math.PI * 7 - time * 0.22)) * 17)
        const corridor = Math.max(0, 1 - Math.abs(py - (0.78 - Math.abs(px - 0.5) * 0.5 + scroll * 0.06)) * 11)
        const grain = hash(x, y)
        const dust = grain > 0.935 ? (grain - 0.935) * 1.65 : 0
        const starSeed = hash(Math.floor(px * 116 + scroll * 11), Math.floor(py * 92 - time * 2.2))
        const star = starSeed > 0.991 ? (starSeed - 0.991) * 42 : 0
        const vhsTear = Math.max(0, 1 - Math.abs(Math.sin((py + noiseA * 0.08 + time * 0.035) * 122)) * 28) * (0.26 + noiseB * 0.6)
        const vignette = Math.max(0, 1 - radius * 1.66)
        let beacon = 0
        let beaconTone = 0

        for (const [sx, sy, power, spread, toneIndex] of signals) {
          const sxDrift = sx + Math.sin(time * 0.13 + toneIndex * 2.1 + scroll * 2.2) * 0.026
          const syDrift = sy + Math.cos(time * 0.11 + toneIndex * 1.4 + scroll * 1.8) * 0.022
          const bdx = px - sxDrift
          const bdy = py - syDrift + scrollParallax * 0.42
          const bRadius = Math.sqrt(bdx * bdx + bdy * bdy)
          const beamCore = Math.max(0, 1 - bRadius * (3.85 / Math.max(0.2, spread))) * power
          const beamSweep = Math.max(0, 1 - Math.abs(Math.atan2(bdy, bdx) - Math.sin(time * 0.18 + toneIndex + noiseA) * 0.9) * 0.48) * beamCore
          const beam = beamCore + beamSweep * 0.2
          if (beam > beacon) {
            beacon = beam
            beaconTone = toneIndex
          }
        }

        const signal =
          0.045 +
          tunnel * 0.18 +
          ring * 0.09 +
          drift * 0.17 +
          contour * 0.12 +
          lattice * 0.13 +
          (noiseA - 0.5) * 0.24 +
          (noiseB - 0.5) * 0.12 +
          plasma * 0.08 +
          horizon * 0.1 +
          vanishing * corridor * 0.12 +
          scanBand * 0.2 +
          wireA * 0.2 +
          wireB * 0.13 +
          godRay * 0.5 +
          hexGrid * 0.22 +
          dust * 0.18 +
          star * 0.16 +
          vhsTear * 0.08 +
          beacon * 0.5
        const edgeSilence = Math.min(1, Math.max(0, (py - 0.02) * 1.25)) * Math.min(1, Math.max(0, (0.98 - py) * 1.25))
        const threshold = bayer[y % 4][x % 4] + 0.24 - vignette * 0.055 - beacon * 0.32 - scanBand * 0.085 - wireA * 0.075 - godRay * 0.16 - hexGrid * 0.05 + (1 - horizon) * 0.07
        const lit = signal * edgeSilence > threshold ? 1 : 0
        const idx = (y * cols + x) * 4
        const tone = Math.sin(px * 9.2 - py * 11.4 + time * 0.7 + scroll * 5.2 + beaconTone + noiseB)
        const purpleTone = beaconTone === 1 || tone > 0.28 || godRay > 0.34
        const blueTone = beaconTone === 2 && tone < -0.18
        const red = purpleTone ? 125 + Math.round(vignette * 48 + beacon * 22 + godRay * 16) : blueTone ? 28 : 18 + Math.round(scanBand * 10 + star * 10)
        const green = purpleTone ? 46 + Math.round(horizon * 28 + beacon * 12) : blueTone ? 82 : 84 + Math.round(vignette * 74 + horizon * 38 + hexGrid * 18)
        const blue = purpleTone ? 188 + Math.round(vignette * 34 + beacon * 18 + godRay * 18) : blueTone ? 138 + Math.round(horizon * 46) : 82 + Math.round((vignette + horizon) * 23)
        const alpha = lit
          ? 9 + Math.round(vignette * 20 + horizon * 10 + scanBand * 14 + beacon * 38 + wireA * 11 + godRay * 22 + hexGrid * 9 + star * 18)
          : Math.round(vignette * 2 + godRay * 2)

        data[idx] = lit ? red : 3
        data[idx + 1] = lit ? green : 5
        data[idx + 2] = lit ? blue : 9
        data[idx + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    const isCompactDither = window.innerWidth <= 760
    const isPhoneDither = window.innerWidth <= 480
    const ditherScale = isCompactDither ? 1 : 1.055
    const parallaxX = isCompactDither ? 0 : (smoothX - 0.5) * -20
    const parallaxY = isPhoneDither ? 0 : isCompactDither ? -scroll * 12 : -scroll * 44 + (smoothY - 0.24) * 12
    const roll = isCompactDither ? 0 : (smoothX - 0.5) * 1.4 + (scroll - 0.5) * 0.45
    shell.style.setProperty('--rn-dither-scroll', scroll.toFixed(4))
    shell.style.setProperty('--rn-dither-parallax-x', `${parallaxX.toFixed(2)}px`)
    shell.style.setProperty('--rn-dither-parallax-y', `${parallaxY.toFixed(2)}px`)
    shell.style.setProperty('--rn-dither-roll', `${roll.toFixed(3)}deg`)
    shell.style.setProperty('--rn-dither-scale', ditherScale.toFixed(3))
    needsDraw = false

    if (!reduceMotion.matches || needsDraw) {
      frame = window.requestAnimationFrame(draw)
    }
  }

  window.addEventListener('resize', () => {
    resize()
    if (reduceMotion.matches) {
      draw()
    }
  })

  window.addEventListener(
    'pointermove',
    (event) => {
      pointerX = Math.max(0, Math.min(1, event.clientX / Math.max(1, width)))
      pointerY = Math.max(0, Math.min(1, event.clientY / Math.max(1, height)))
      needsDraw = true
    },
    { passive: true }
  )

  resize()
  draw()

  reduceMotion.addEventListener?.('change', () => {
    if (frame) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
    start = performance.now()
    needsDraw = true
    draw()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !frame) {
      start = performance.now()
      needsDraw = true
      frame = window.requestAnimationFrame(draw)
    }
  })
}

function initAmbientOrbits() {
  if (document.body?.dataset.page === 'landing' || document.querySelector('.rn-ambient-orbits')) {
    return
  }

  const field = document.createElement('div')
  field.className = 'rn-ambient-orbits'
  field.setAttribute('aria-hidden', 'true')

  const seeds = [
    [10, 16, 14, 18, 'green'],
    [28, 82, 11, 24, 'blue'],
    [42, 26, 8, 20, 'purple'],
    [58, 72, 16, 28, 'green'],
    [74, 18, 10, 22, 'blue'],
    [88, 54, 13, 26, 'green'],
    [18, 58, 7, 19, 'purple'],
    [66, 38, 9, 23, 'green'],
  ]

  seeds.forEach(([x, y, size, speed, tone], index) => {
    const node = document.createElement('span')
    node.style.setProperty('--rn-orbit-x', `${x}%`)
    node.style.setProperty('--rn-orbit-y', `${y}%`)
    node.style.setProperty('--rn-orbit-size', `${size}rem`)
    node.style.setProperty('--rn-orbit-speed', `${speed}s`)
    node.style.setProperty('--rn-orbit-delay', `${index * -2.7}s`)
    node.dataset.tone = tone
    field.appendChild(node)
  })

  document.body.prepend(field)
}

function initScrollKinetics() {
  let lastY = window.scrollY
  let lastTime = performance.now()
  let frame = 0
  let settleTimer = 0

  const sync = () => {
    frame = 0
    const now = performance.now()
    const y = window.scrollY
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const progress = Math.min(1, Math.max(0, y / scrollable))
    const delta = y - lastY
    const elapsed = Math.max(16, now - lastTime)
    const velocity = Math.max(-1, Math.min(1, delta / elapsed))

    document.documentElement.style.setProperty('--rn-scroll-ratio', progress.toFixed(4))
    document.documentElement.style.setProperty('--rn-scroll-px', y.toFixed(1))
    document.documentElement.style.setProperty('--rn-scroll-velocity', velocity.toFixed(4))
    document.body.classList.toggle('is-scrolling-down', delta > 1)
    document.body.classList.toggle('is-scrolling-up', delta < -1)
    document.body.classList.add('is-scrolling')

    window.clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => {
      document.body.classList.remove('is-scrolling', 'is-scrolling-down', 'is-scrolling-up')
      document.documentElement.style.setProperty('--rn-scroll-velocity', '0')
    }, 180)

    lastY = y
    lastTime = now
  }

  const schedule = () => {
    if (!frame) {
      frame = window.requestAnimationFrame(sync)
    }
  }

  sync()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}

function initNavAccessibilityState() {
  const navLinks = [...document.querySelectorAll('.site-nav a, .rn-nav-link')]
  navLinks.forEach((link) => {
    if (link.classList.contains('is-current')) {
      link.setAttribute('aria-current', 'page')
    }
  })

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.attributeName !== 'class' || !(record.target instanceof HTMLElement)) {
        return
      }

      if (!record.target.matches('.site-nav a, .rn-nav-link')) {
        return
      }

      if (record.target.classList.contains('is-current')) {
        record.target.setAttribute('aria-current', 'page')
      } else {
        record.target.removeAttribute('aria-current')
      }
    })
  })

  navLinks.forEach((link) => observer.observe(link, { attributes: true }))
}

function initScrollableNavRails() {
  const rails = [
    ...document.querySelectorAll(
      '.site-header .site-nav, .site-header__actions, .rn-nav-links, .rn-nav-cta, .api-docs-topbar__links, .apps-store-topbar__status, .apps-store-sidebar__nav'
    ),
  ]

  if (!rails.length) {
    return
  }

  const resizeObserver =
    'ResizeObserver' in window
      ? new ResizeObserver((entries) => {
          entries.forEach((entry) => syncRail(entry.target))
        })
      : null

  const syncRail = (rail) => {
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
    const isScrollable = maxScroll > 2
    rail.classList.toggle('is-scrollable-x', isScrollable)
    rail.classList.toggle('is-scrolled-x', isScrollable && rail.scrollLeft > 4)
    rail.classList.toggle('is-at-end-x', !isScrollable || rail.scrollLeft >= maxScroll - 4)
  }

  const revealCurrent = (rail, behavior = 'auto') => {
    const current = rail.querySelector('.is-current, [aria-current="page"], [aria-pressed="true"]')
    if (!current) {
      return
    }

    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
    if (maxScroll <= 2) {
      return
    }

    const railRect = rail.getBoundingClientRect()
    const currentRect = current.getBoundingClientRect()
    const railCenter = railRect.left + railRect.width / 2
    const currentCenter = currentRect.left + currentRect.width / 2
    const nextLeft = Math.max(0, Math.min(maxScroll, rail.scrollLeft + currentCenter - railCenter))

    rail.scrollTo({ left: nextLeft, behavior })
  }

  rails.forEach((rail) => {
    let frame = 0
    const schedule = () => {
      if (frame) {
        return
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncRail(rail)
      })
    }

    syncRail(rail)
    window.requestAnimationFrame(() => {
      revealCurrent(rail)
      syncRail(rail)
    })

    rail.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    resizeObserver?.observe(rail)

    rail.addEventListener(
      'wheel',
      (event) => {
        const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? rail.clientWidth : 1
        const rawDeltaX = event.deltaX * deltaScale
        const rawDeltaY = event.deltaY * deltaScale
        const horizontalDelta = Math.abs(rawDeltaX)
        const verticalDelta = Math.abs(rawDeltaY)
        const explicitHorizontalIntent =
          (horizontalDelta > 6 && horizontalDelta > verticalDelta * 1.2) ||
          (event.shiftKey && verticalDelta > 2 && verticalDelta >= horizontalDelta)
        if (!explicitHorizontalIntent) {
          if (
            rail.matches('.apps-store-sidebar__nav') &&
            verticalDelta > 1 &&
            event.cancelable
          ) {
            const maxTop = Math.max(0, rail.scrollHeight - rail.clientHeight)
            const nextTop = Math.max(0, Math.min(maxTop, rail.scrollTop + rawDeltaY))
            const canScrollRail = maxTop > 2 && Math.abs(nextTop - rail.scrollTop) > 0.5

            if (canScrollRail) {
              event.preventDefault()
              rail.scrollTop = nextTop
            }
          }
          return
        }

        const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
        if (maxScroll <= 2) {
          return
        }

        const delta =
          event.shiftKey && verticalDelta >= horizontalDelta ? rawDeltaY : rawDeltaX
        if (!delta) {
          return
        }

        const nextLeft = Math.max(0, Math.min(maxScroll, rail.scrollLeft + delta))
        if (Math.abs(nextLeft - rail.scrollLeft) < 0.5) {
          return
        }

        event.preventDefault()
        rail.scrollLeft = nextLeft
        syncRail(rail)
      },
      { passive: false }
    )

    rail.addEventListener('keydown', (event) => {
      const step = Math.max(120, rail.clientWidth * 0.55)
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        rail.scrollBy({ left: step, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        rail.scrollBy({ left: -step, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
      } else if (event.key === 'Home') {
        event.preventDefault()
        rail.scrollTo({ left: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
      } else if (event.key === 'End') {
        event.preventDefault()
        rail.scrollTo({ left: rail.scrollWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
      }
    })

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        revealCurrent(rail, reduceMotion.matches ? 'auto' : 'smooth')
        syncRail(rail)
      })
    })

    observer.observe(rail, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'aria-current', 'aria-pressed'],
    })
  })
}

function initNavIndicatorRails() {
  const rails = [
    ...document.querySelectorAll('.site-header .site-nav, .site-header__actions, .rn-nav-links, .rn-nav-cta'),
  ]

  if (!rails.length) {
    return
  }

  rails.forEach((rail) => {
    if (rail.querySelector(':scope > .rn-nav-indicator')) {
      return
    }

    const indicator = document.createElement('span')
    indicator.className = 'rn-nav-indicator'
    indicator.setAttribute('aria-hidden', 'true')
    rail.prepend(indicator)

    let frame = 0
    let activeTarget = null

    const isUtilityRail = rail.matches('.site-header__actions, .rn-nav-cta')
    const resolveTarget = () =>
      activeTarget ||
      rail.querySelector('a.is-hovered, a:focus-visible, a[aria-current="page"], a.is-current') ||
      (isUtilityRail ? null : rail.querySelector('a'))

    const sync = () => {
      frame = 0
      const target = resolveTarget()
      if (!target) {
        rail.classList.remove('has-nav-indicator')
        return
      }

      const railRect = rail.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const x = targetRect.left - railRect.left + rail.scrollLeft
      const y = targetRect.top - railRect.top + rail.scrollTop

      rail.style.setProperty('--rn-nav-indicator-x', `${x.toFixed(2)}px`)
      rail.style.setProperty('--rn-nav-indicator-y', `${y.toFixed(2)}px`)
      rail.style.setProperty('--rn-nav-indicator-w', `${targetRect.width.toFixed(2)}px`)
      rail.style.setProperty('--rn-nav-indicator-h', `${targetRect.height.toFixed(2)}px`)
      rail.classList.add('has-nav-indicator')
    }

    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(sync)
      }
    }

    rail.addEventListener('pointerover', (event) => {
      const link = event.target?.closest?.('a')
      if (!link || !rail.contains(link)) {
        return
      }

      activeTarget?.classList.remove('is-hovered')
      activeTarget = link
      activeTarget.classList.add('is-hovered')
      schedule()
    })

    rail.addEventListener('pointerout', (event) => {
      const link = event.target?.closest?.('a')
      if (!link || link.contains(event.relatedTarget)) {
        return
      }

      link.classList.remove('is-hovered')
      activeTarget = null
      schedule()
    })

    rail.addEventListener('focusin', (event) => {
      const link = event.target?.closest?.('a')
      if (!link || !rail.contains(link)) {
        return
      }

      activeTarget?.classList.remove('is-hovered')
      activeTarget = link
      activeTarget.classList.add('is-hovered')
      schedule()
    })

    rail.addEventListener('focusout', (event) => {
      const link = event.target?.closest?.('a')
      if (!link) {
        return
      }

      link.classList.remove('is-hovered')
      activeTarget = null
      schedule()
    })

    rail.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    const observer = new MutationObserver(schedule)
    observer.observe(rail, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'aria-current'],
    })

    window.requestAnimationFrame(sync)
  })
}

function initLocalAnchorNavigation() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    const link = event.target?.closest?.('a[href*="#"]')
    if (!link) {
      return
    }

    const href = link.getAttribute('href') || ''
    if (!href || href === '#') {
      return
    }

    let url
    try {
      url = new URL(href, window.location.href)
    } catch (_) {
      return
    }

    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) {
      return
    }

    const id = decodeURIComponent(url.hash.slice(1))
    const target = id ? document.getElementById(id) : null
    if (!target) {
      return
    }

    event.preventDefault()
    target.scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    })

    window.history.pushState(null, '', url.hash)
    target.classList.add('rn-anchor-target')

    const hadTabIndex = target.hasAttribute('tabindex')
    if (!hadTabIndex) {
      target.setAttribute('tabindex', '-1')
    }

    window.setTimeout(
      () => {
        target.focus({ preventScroll: true })
        target.classList.remove('rn-anchor-target')
        if (!hadTabIndex) {
          target.removeAttribute('tabindex')
        }
      },
      reduceMotion.matches ? 0 : 320
    )
  })
}

function initMediaLoadStates() {
  const images = [...document.querySelectorAll('.screen-frame__image, .app-screen-shot img')]
  if (!images.length) {
    return
  }

  document.body.classList.add('is-polish-ready')

  const markLoaded = (image) => {
    image.classList.add('is-media-loaded')
    image.closest('.screen-frame, .app-screen-shot, .surface-card__shot, .ios-shot-card')?.classList.add('is-media-loaded')
  }

  images.forEach((image) => {
    if (image.complete) {
      markLoaded(image)
      return
    }

    image.addEventListener('load', () => markLoaded(image), { once: true })
    image.addEventListener('error', () => markLoaded(image), { once: true })
  })
}

function initSharedMicrointeractions() {
  if (reduceMotion.matches) {
    return
  }

  ensurePointerLight()

  const magneticSelector = [
    '.cta',
    '.rn-btn',
    '.rn-nav-link',
    '.rn-nav-primary',
    '.rn-nav-ghost',
    '.site-action-pill',
    '.site-nav a',
    '.apps-card',
    '.apps-card__install',
    '.apps-card__more',
    '.apps-store-sidebar__quick a',
    '.api-docs-group',
    '.api-route-card',
    '.sitemap-card',
    '.sitemap-card a',
    '.rc-sidebar__link',
    '.rc-starter-card',
    '.account-panel',
    '.account-mini-card',
  ].join(', ')

  let pointerX = window.innerWidth * 0.5
  let pointerY = window.innerHeight * 0.2
  let frame = 0
  let pointerLiveTimer = 0

  const syncPointer = () => {
    frame = 0
    document.documentElement.style.setProperty('--rn-pointer-x', `${pointerX.toFixed(1)}px`)
    document.documentElement.style.setProperty('--rn-pointer-y', `${pointerY.toFixed(1)}px`)
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      pointerX = event.clientX
      pointerY = event.clientY
      document.body.classList.add('is-pointer-live')
      window.clearTimeout(pointerLiveTimer)
      pointerLiveTimer = window.setTimeout(() => {
        document.body.classList.remove('is-pointer-live')
      }, 900)

      if (!frame) {
        frame = window.requestAnimationFrame(syncPointer)
      }

      const target = event.target?.closest?.(magneticSelector)
      if (!target) {
        return
      }

      const rect = target.getBoundingClientRect()
      const localX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      const localY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1
      const large = target.matches('.api-route-card, .apps-card, .sitemap-card, .account-panel, .rc-starter-card')
      const strength = large ? 4 : 7

      target.style.setProperty('--rn-magnet-x', `${(localX * strength).toFixed(2)}px`)
      target.style.setProperty('--rn-magnet-y', `${(localY * strength * 0.62).toFixed(2)}px`)
      target.style.setProperty('--rn-hover-x', `${(((localX + 1) / 2) * 100).toFixed(2)}%`)
      target.style.setProperty('--rn-hover-y', `${(((localY + 1) / 2) * 100).toFixed(2)}%`)
    },
    { passive: true }
  )

  document.addEventListener(
    'pointerout',
    (event) => {
      const target = event.target?.closest?.(magneticSelector)
      if (!target || target.contains(event.relatedTarget)) {
        return
      }

      target.style.setProperty('--rn-magnet-x', '0px')
      target.style.setProperty('--rn-magnet-y', '0px')
    },
    { passive: true }
  )

  document.addEventListener('pointerdown', (event) => {
    const target = event.target?.closest?.(magneticSelector)
    if (!target) {
      return
    }

    target.classList.add('is-pressing')
    window.setTimeout(() => target.classList.remove('is-pressing'), 180)
  })
}

function initClickRipples() {
  if (reduceMotion.matches) {
    return
  }

  const selector = [
    'a[href]',
    'button',
    '[role="button"]',
    '.apps-card',
    '.api-route-card',
    '.api-docs-group',
    '.rc-starter-card',
    '.account-tab',
  ].join(', ')

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || event.pointerType === 'touch') {
        return
      }

      const target = event.target?.closest?.(selector)
      if (!target) {
        return
      }

      const ripple = document.createElement('span')
      ripple.className = 'rn-click-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      ripple.setAttribute('aria-hidden', 'true')
      document.body.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    },
    { passive: true }
  )
}

function initActiveSectionNav() {
  const pageAnchors = [...document.querySelectorAll('.site-nav a[href^="#"], .rn-nav-link[href^="#"]')]
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1)
      return id ? { link, section: document.getElementById(id) } : null
    })
    .filter((item) => item?.section)

  if (!('IntersectionObserver' in window) || !pageAnchors.length) {
    return
  }

  const navObserver = new IntersectionObserver(
    (entries) => {
      const active = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

      if (!active) {
        return
      }

      pageAnchors.forEach(({ link, section }) => {
        link.classList.toggle('is-current', section === active.target)
      })
    },
    { threshold: [0.18, 0.34, 0.5], rootMargin: '-22% 0px -58% 0px' }
  )

  pageAnchors.forEach(({ section }) => navObserver.observe(section))
}

function initChromeScrollState() {
  const chrome = [
    ...document.querySelectorAll('.site-header, .api-docs-topbar, .apps-store-topbar, .rc-main__topbar'),
  ]

  if (!chrome.length) {
    return
  }

  const sync = () => {
    const scrolled = window.scrollY > 12
    chrome.forEach((element) => {
      element.classList.toggle('is-scrolled', scrolled)
      element.dataset.scrolled = scrolled ? 'true' : 'false'
    })
  }

  sync()
  window.addEventListener('scroll', sync, { passive: true })
}

function initRevealObserver() {
  const revealTargets = [...document.querySelectorAll('[data-reveal]')].filter(
    (target) => !target.classList.contains('is-visible') && !target.classList.contains('is-revealed')
  )

  if (!revealTargets.length) {
    return
  }

  if (window.location.hash) {
    const anchored = document.querySelector(window.location.hash)
    if (anchored) {
      anchored.classList.add('is-visible', 'is-revealed')
      anchored.querySelectorAll('[data-reveal]').forEach((target) => {
        target.classList.add('is-visible', 'is-revealed')
      })
    }
  }

  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach((target) => {
      target.classList.add('is-visible', 'is-revealed')
    })
    return
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return
        }

        entry.target.classList.add('is-visible', 'is-revealed')
        revealObserver.unobserve(entry.target)
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -42px 0px' }
  )

  revealTargets.forEach((target) => revealObserver.observe(target))
}

initInputModality()
initDitherField()
initAmbientOrbits()
initScrollKinetics()
initSkipLink()
initReadingProgress()
initSharedMicrointeractions()
initClickRipples()
initActiveSectionNav()
initChromeScrollState()
initScrollableNavRails()
initNavIndicatorRails()
initLocalAnchorNavigation()
initMediaLoadStates()
initRevealObserver()
initNavAccessibilityState()
