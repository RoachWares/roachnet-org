// Halloween mode for roachnet.org, apps.roachnet.org and accounts.roachnet.org.
//
// Loaded in <head> without defer, so the theme (nx-halloween.css) is set before the
// first paint and pages never flash from the normal palette into the spooky one.
// Everything else (the switches, the moon, bats, fog, webs, the spider) waits for
// the DOM. Out of season the script returns at once and loads nothing.
//
// The switch is offered from 1 October to 2 November and starts on from
// 24 October to 1 November. A visitor's choices are kept in two first-party
// cookies shared by the roachnet.org hosts (rn_halloween=on|off and
// rn_halloween_theme=<palette>, 45 days); nothing else is stored or sent
// anywhere. ?halloween=on|off and ?halloween-theme=<palette> set them from a
// link, and ?halloween=on previews the theme out of season without saving anything.
//
// The palettes are RoachNet's Halloween themes, the same ones the app offers;
// the effects layer (moon, bats, fog, webs, the spider) is the same for all of them.
//
// CSP: no inline script or style. Styles change through classes, attributes and
// CSSOM only. Motion stands down under prefers-reduced-motion, while the tab is
// hidden, and on coarse pointers where it would get in the way.
;(function () {
  'use strict'

  var root = document.documentElement
  var cookieName = 'rn_halloween'
  var cookieDays = 45
  var today = new Date()
  var month = today.getMonth()
  var day = today.getDate()
  var inSeason = month === 9 || (month === 10 && day <= 2)
  var startsOn = (month === 9 && day >= 24) || (month === 10 && day <= 1)

  // The palettes are RoachNet's own Halloween themes (the app's Pumpkin Patch and
  // the Halloween Collection pack), turned into these sites' tokens by
  // scripts/build-halloween-themes.mjs. Keep this list in step with that script;
  // test/site-outcomes.mjs checks it.
  var themes = [
    { slug: 'pumpkin-patch', name: 'Pumpkin Patch' },
    { slug: 'witch-light', name: 'Witch Light' },
    { slug: 'hollow-moon', name: 'Hollow Moon' },
    { slug: 'haunted-static', name: 'Haunted Static' },
  ]
  var themeCookie = 'rn_halloween_theme'
  function knownTheme(slug) {
    for (var i = 0; i < themes.length; i += 1) if (themes[i].slug === slug) return themes[i]
    return null
  }

  var asked = null
  var askedTheme = null
  try {
    var params = new URLSearchParams(window.location.search)
    asked = params.get('halloween')
    askedTheme = params.get('halloween-theme')
  } catch (error) {
    asked = null
  }
  if (asked !== 'on' && asked !== 'off') asked = null
  if (!knownTheme(askedTheme)) askedTheme = null
  if (!inSeason && asked !== 'on') return

  // The stylesheets load only while the switch is offered, next to this script:
  // the palettes first, then the effects that use them. blocking="render" keeps
  // Chromium from painting before they arrive; WebKit already waits for
  // stylesheets added to <head> before the body.
  var script = document.currentScript
  try {
    var anchor = script && script.parentNode ? script : null
    ;['nx-halloween-themes.css', 'nx-halloween.css'].forEach(function (file) {
      var sheet = document.createElement('link')
      sheet.rel = 'stylesheet'
      sheet.href = new URL(file, script && script.src ? script.src : window.location.href).href
      sheet.setAttribute('blocking', 'render')
      if (anchor) {
        anchor.parentNode.insertBefore(sheet, anchor.nextSibling)
        anchor = sheet
      } else {
        document.head.appendChild(sheet)
      }
    })
  } catch (error) {
    // Without the stylesheets the switch still works; it just looks plain.
  }

  function readChoice() {
    try {
      var match = document.cookie.match(/(?:^|;\s*)rn_halloween=(on|off)(?:;|$)/)
      return match ? match[1] : null
    } catch (error) {
      return null
    }
  }

  function saveCookie(name, value) {
    if (!inSeason) return
    try {
      var shared = /(^|\.)roachnet\.org$/.test(window.location.hostname) ? '; domain=roachnet.org' : ''
      var secure = window.location.protocol === 'https:' ? '; secure' : ''
      document.cookie =
        name + '=' + value + '; max-age=' + cookieDays * 86400 + '; path=/; samesite=lax' + shared + secure
    } catch (error) {
      // Cookies blocked: the switch still works for this page view.
    }
  }
  function saveChoice(value) {
    saveCookie(cookieName, value)
  }

  function readTheme() {
    try {
      var match = document.cookie.match(/(?:^|;\s*)rn_halloween_theme=([a-z-]+)(?:;|$)/)
      return match && knownTheme(match[1]) ? match[1] : null
    } catch (error) {
      return null
    }
  }

  if (asked) saveChoice(asked)
  if (askedTheme) saveCookie(themeCookie, askedTheme)
  var choice = asked || readChoice()
  var on = choice ? choice === 'on' : startsOn
  var theme = askedTheme || readTheme() || themes[0].slug
  root.setAttribute('data-halloween-theme', theme)

  var themeMeta = null
  var normalThemeColor = ''
  var switches = []
  var pickers = []
  var layer = null
  var moon = null
  var spider = null
  var spiderTimers = []
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  var finePointer = window.matchMedia('(pointer: fine)')

  function motionOK() {
    return !reduced.matches
  }

  function paletteBackground() {
    try {
      return getComputedStyle(root).getPropertyValue('--nx-bg').trim() || '#110904'
    } catch (error) {
      return '#110904'
    }
  }

  function applyTheme(slug) {
    theme = slug
    root.setAttribute('data-halloween-theme', slug)
    if (themeMeta && on) themeMeta.setAttribute('content', paletteBackground())
    pickers.forEach(function (picker) {
      picker.value = slug
    })
  }

  function apply(state) {
    on = state
    if (state) root.setAttribute('data-halloween', 'on')
    else root.removeAttribute('data-halloween')
    if (themeMeta) themeMeta.setAttribute('content', state ? paletteBackground() : normalThemeColor)
    pickers.forEach(function (picker) {
      picker.parentNode.hidden = !state
    })
    switches.forEach(function (control) {
      control.setAttribute('aria-pressed', String(state))
      var label = control.querySelector('[data-spook-label]')
      if (label) label.textContent = state ? 'Halloween mode: on' : 'Halloween mode: off'
      control.title = state ? 'Halloween mode is on' : 'Halloween mode is off'
    })
    if (state) buildLayer()
    if (layer) layer.hidden = !state
    if (moon) moon.hidden = !state
    if (state) dropSpider()
    else raiseSpider(true)
  }

  root.setAttribute('data-halloween-season', inSeason ? 'live' : 'preview')
  if (on) root.setAttribute('data-halloween', 'on')

  /* ------------------------------------------------------------------ SVG */

  var svgNS = 'http://www.w3.org/2000/svg'

  function svg(name, attributes, children) {
    var element = document.createElementNS(svgNS, name)
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key])
    })
    ;(children || []).forEach(function (child) {
      element.appendChild(child)
    })
    return element
  }

  function pumpkinIcon() {
    return svg('svg', { class: 'nx-spook-pumpkin', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
      svg('path', { class: 'nx-spook-pumpkin__stem', d: 'M12 6.4c-.1-1.7.5-3 1.9-3.9' }),
      svg('path', {
        class: 'nx-spook-pumpkin__body',
        d: 'M12 6.3c-1.3-.9-3.1-1.1-4.7-.4C4.6 7 3 9.7 3 13.1c0 3.4 1.9 6.2 4.6 7.1 1.5.5 3.1.4 4.4-.3 1.3.7 2.9.8 4.4.3 2.7-.9 4.6-3.7 4.6-7.1 0-3.4-1.6-6.1-4.3-7.2-1.6-.7-3.4-.5-4.7.4z',
      }),
      svg('path', { class: 'nx-spook-pumpkin__rib', d: 'M12 6.3c-1.6 1.9-2.1 4.4-2.1 6.8s.6 5 2.1 6.8c1.5-1.8 2.1-4.4 2.1-6.8s-.5-4.9-2.1-6.8' }),
      svg('path', {
        class: 'nx-spook-pumpkin__face',
        d: 'M7.9 11.4l1.7-2 1.4 2zM13 11.4l1.4-2 1.7 2zM7.6 14.1c1 .1 1.4.9 2.1.9l.8-.8.9.9h1.2l.9-.9.8.8c.7 0 1.1-.8 2.1-.9-.4 2.1-2.3 3.5-4.4 3.5s-4-1.4-4.4-3.5z',
      }),
    ])
  }

  function batShape() {
    return svg('svg', { viewBox: '0 0 64 30', focusable: 'false' }, [
      svg('path', {
        d: 'M32 9.6c.9-1.6 1.9-2.7 2.6-3.4.3 1.1.4 2.2.3 3.1 3.9-3.3 9.4-5.2 16.3-5.2-2.9 1.7-4.5 3.8-4.7 6.3 3.5-.5 7 .4 10.6 2.9-4.1-.2-7 .9-8.8 3.5-2.4-1.3-5.3-1.5-8.8-.6-2.2.6-3.9 2-4.9 4.3l-2.6 3.9-2.6-3.9c-1-2.3-2.7-3.7-4.9-4.3-3.5-.9-6.4-.7-8.8.6-1.8-2.6-4.7-3.7-8.8-3.5 3.6-2.5 7.1-3.4 10.6-2.9-.2-2.5-1.8-4.6-4.7-6.3 6.9 0 12.4 1.9 16.3 5.2-.1-.9 0-2 .3-3.1.7.7 1.7 1.8 2.6 3.4z',
      }),
    ])
  }

  // A corner web: spokes from the corner, sagging threads between them.
  function cobweb() {
    var spokes = [0, 14, 30, 47, 63, 78, 90]
    var rings = [26, 50, 76, 104, 134, 166]
    var point = function (radius, degrees) {
      var radians = (degrees * Math.PI) / 180
      return [radius * Math.cos(radians), radius * Math.sin(radians)]
    }
    var d = ''
    spokes.forEach(function (angle) {
      var end = point(196, angle)
      d += 'M0 0L' + end[0].toFixed(1) + ' ' + end[1].toFixed(1)
    })
    rings.forEach(function (radius) {
      spokes.forEach(function (angle, index) {
        var start = point(radius, angle)
        if (index === 0) {
          d += 'M' + start[0].toFixed(1) + ' ' + start[1].toFixed(1)
          return
        }
        var previous = spokes[index - 1]
        var sag = point(radius * 0.86, (previous + angle) / 2)
        d += 'Q' + sag[0].toFixed(1) + ' ' + sag[1].toFixed(1) + ' ' + start[0].toFixed(1) + ' ' + start[1].toFixed(1)
      })
    })
    return svg('svg', { viewBox: '0 0 200 200', focusable: 'false' }, [svg('path', { d: d })])
  }

  function spiderShape() {
    var legs = ''
    ;[-1, 1].forEach(function (side) {
      ;[
        [3, -3, 9, -8, 12, -4],
        [3, -1, 10, -3, 13, 1],
        [3, 1, 10, 3, 12, 8],
        [3, 3, 8, 8, 9, 12],
      ].forEach(function (leg) {
        legs +=
          'M' + (16 + side * leg[0]) + ' ' + (15 + leg[1]) +
          'Q' + (16 + side * leg[2]) + ' ' + (15 + leg[3]) + ' ' + (16 + side * leg[4]) + ' ' + (15 + leg[5])
      })
    })
    return svg('svg', { viewBox: '0 0 32 32', focusable: 'false' }, [
      svg('path', { class: 'nx-spook-spider__legs', d: legs }),
      svg('ellipse', { class: 'nx-spook-spider__body', cx: '16', cy: '16.5', rx: '4.6', ry: '5.4' }),
      svg('circle', { class: 'nx-spook-spider__body', cx: '16', cy: '10.4', r: '2.8' }),
      svg('circle', { class: 'nx-spook-spider__eye', cx: '14.9', cy: '10.1', r: '0.75' }),
      svg('circle', { class: 'nx-spook-spider__eye', cx: '17.1', cy: '10.1', r: '0.75' }),
    ])
  }

  function ghostShape() {
    return svg('svg', { viewBox: '0 0 40 48', focusable: 'false' }, [
      svg('path', {
        class: 'nx-spook-ghost__sheet',
        d: 'M20 2C10.6 2 4 9.4 4 19v25l5.3-4.4 5.3 4.4 5.4-4.4 5.4 4.4 5.3-4.4L36 44V19C36 9.4 29.4 2 20 2z',
      }),
      svg('ellipse', { class: 'nx-spook-ghost__eye', cx: '14.5', cy: '19', rx: '2.4', ry: '3.2' }),
      svg('ellipse', { class: 'nx-spook-ghost__eye', cx: '25.5', cy: '19', rx: '2.4', ry: '3.2' }),
      svg('ellipse', { class: 'nx-spook-ghost__eye', cx: '20', cy: '28', rx: '2.6', ry: '2.2' }),
    ])
  }

  function span(className, children) {
    var element = document.createElement('span')
    element.className = className
    ;(children || []).forEach(function (child) {
      element.appendChild(child)
    })
    return element
  }

  /* ---------------------------------------------------------------- Layer */

  function buildLayer() {
    if (layer || !document.body) return
    layer = span('nx-spook')
    layer.setAttribute('aria-hidden', 'true')
    moon = span('nx-spook-moon', [span('nx-spook__cloud')])
    moon.setAttribute('aria-hidden', 'true')
    document.body.appendChild(moon)
    layer.appendChild(span('nx-spook__web nx-spook__web--right', [cobweb()]))
    layer.appendChild(span('nx-spook__web nx-spook__web--left', [cobweb()]))
    if (motionOK()) {
      for (var index = 1; index <= 4; index += 1) {
        layer.appendChild(span('nx-spook__bat nx-spook__bat--' + index, [span('nx-spook__wings', [batShape()])]))
      }
    }
    layer.appendChild(span('nx-spook__fog', [span('nx-spook__fog-a'), span('nx-spook__fog-b')]))
    var atmosphere = document.querySelector('.nx-atmos')
    if (atmosphere && atmosphere.parentNode) atmosphere.parentNode.insertBefore(layer, atmosphere.nextSibling)
    else document.body.insertBefore(layer, document.body.firstChild)

    var mark = document.querySelector('.nx-foot__mark')
    if (mark && !mark.querySelector('.nx-spook-ghost')) {
      var ghost = span('nx-spook-ghost', [ghostShape()])
      ghost.setAttribute('aria-hidden', 'true')
      mark.appendChild(ghost)
    }
  }

  /* --------------------------------------------------------------- Spider */

  // One spider drops in under the nav on marketing pages, hangs about, and climbs
  // back out of the way. Touch it and it leaves early. Never on the working pages
  // (RoachClaw, Account, Apps, API), where it could sit over a control.
  var spiderPages = ['landing', 'home', 'brew', 'ios', 'sitemap', '404']

  function clearSpiderTimers() {
    spiderTimers.forEach(function (timer) {
      window.clearTimeout(timer)
    })
    spiderTimers = []
  }

  function raiseSpider(remove) {
    if (!spider) return
    clearSpiderTimers()
    spider.classList.remove('is-down')
    spider.classList.add('is-up')
    if (remove) {
      var leaving = spider
      spider = null
      spiderTimers.push(window.setTimeout(function () {
        leaving.remove()
      }, 1400))
    }
  }

  function dropSpider() {
    if (spider || !motionOK() || document.hidden) return
    var page = document.body && document.body.getAttribute('data-page')
    if (spiderPages.indexOf(page) === -1) return
    var nav = document.querySelector('.nx-nav')
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 64
    spider = span('nx-spook-spider', [span('nx-spook-spider__thread'), span('nx-spook-spider__bob', [spiderShape()])])
    spider.setAttribute('aria-hidden', 'true')
    spider.style.setProperty('--nx-spider-drop', Math.round(Math.max(56, navBottom) + 54) + 'px')
    var leave = function () {
      raiseSpider(true)
    }
    spider.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'mouse' && finePointer.matches) leave()
    })
    spider.addEventListener('pointerdown', leave)
    document.body.appendChild(spider)
    spiderTimers.push(window.setTimeout(function () {
      if (spider) spider.classList.add('is-down')
    }, 1200))
    spiderTimers.push(window.setTimeout(leave, 11000))
  }

  /* ------------------------------------------------------------- Switches */

  var liveRegion = null
  var toast = null
  var toastTimer = 0

  function announce(message) {
    if (!liveRegion) return
    liveRegion.textContent = ''
    window.setTimeout(function () {
      liveRegion.textContent = message
    }, 40)
    if (!toast) return
    toast.querySelector('[data-spook-toast-text]').textContent = message
    toast.classList.add('is-on')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-on')
    }, 2400)
  }

  function flicker(next) {
    if (!motionOK()) {
      next()
      return
    }
    var flash = span('nx-spook-flash')
    flash.setAttribute('aria-hidden', 'true')
    document.body.appendChild(flash)
    window.setTimeout(next, 260)
    window.setTimeout(function () {
      flash.remove()
    }, 760)
  }

  function toggle() {
    var next = !on
    saveChoice(next ? 'on' : 'off')
    flicker(function () {
      apply(next)
      announce(next ? 'Halloween mode is on. Lights out.' : 'Halloween mode is off. Lights back on.')
    })
  }

  function makeSwitch(kind) {
    var control = document.createElement('button')
    control.type = 'button'
    control.className = 'nx-spook-switch nx-spook-switch--' + kind
    control.setAttribute('aria-pressed', String(on))
    control.appendChild(pumpkinIcon())
    var label = document.createElement('span')
    label.setAttribute('data-spook-label', '')
    label.className = kind === 'nav' ? 'nx-spook-switch__label nx-spook-sr' : 'nx-spook-switch__label'
    control.appendChild(label)
    control.addEventListener('click', toggle)
    switches.push(control)
    return control
  }

  // The palette picker sits beside the footer switch while Halloween mode is on.
  function makePicker() {
    var label = document.createElement('label')
    label.className = 'nx-spook-palette'
    var text = document.createElement('span')
    text.className = 'nx-spook-palette__label'
    text.textContent = 'Palette'
    var picker = document.createElement('select')
    picker.className = 'nx-spook-palette__select'
    themes.forEach(function (item) {
      var option = document.createElement('option')
      option.value = item.slug
      option.textContent = item.name
      picker.appendChild(option)
    })
    picker.value = theme
    picker.addEventListener('change', function () {
      var next = knownTheme(picker.value)
      if (!next) return
      saveCookie(themeCookie, next.slug)
      applyTheme(next.slug)
      announce('Palette: ' + next.name + '.')
    })
    label.appendChild(text)
    label.appendChild(picker)
    pickers.push(picker)
    return label
  }

  function mount() {
    themeMeta = document.querySelector('meta[name="theme-color"]')
    normalThemeColor = themeMeta ? themeMeta.getAttribute('content') || '#05060a' : '#05060a'

    var actions = document.querySelector('.nx-nav__actions')
    if (actions) actions.insertBefore(makeSwitch('nav'), actions.firstChild)
    var meta = document.querySelector('.nx-foot__meta-group')
    if (meta) {
      meta.appendChild(makeSwitch('foot'))
      meta.appendChild(makePicker())
    }

    liveRegion = span('nx-spook-sr')
    liveRegion.setAttribute('role', 'status')
    document.body.appendChild(liveRegion)

    toast = span('nx-spook-toast', [pumpkinIcon(), span('nx-spook-toast__text')])
    toast.lastChild.setAttribute('data-spook-toast-text', '')
    toast.setAttribute('aria-hidden', 'true')
    document.body.appendChild(toast)

    apply(on)

    document.addEventListener('visibilitychange', function () {
      root.classList.toggle('nx-spook-paused', document.hidden)
    })
    var onMotionChange = function () {
      if (!motionOK()) raiseSpider(true)
    }
    if (reduced.addEventListener) reduced.addEventListener('change', onMotionChange)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
})()
