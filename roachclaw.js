import {
  clearCachedAuthState,
  getSiteAuthState,
  sessionLabel,
} from './site-account.js'

const root = document.querySelector('#view-roachclaw')

function friendlyAuthError(error, fallback) {
  const message = String(error?.message || '')
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Could not reach the sign-in service. Check your connection and try again.'
  }
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account."
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. The link is in your inbox.'
  return message || fallback
}

if (root) {
  const $ = (selector) => root.querySelector(selector)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  const threadList = $('#roachclaw-thread-list')
  const scroller = $('#roachclaw-scroll')
  const welcome = $('#roachclaw-welcome')
  const log = $('#roachclaw-log')
  const input = $('#roachclaw-input')
  const sendButton = $('#roachclaw-send')
  const hint = $('#roachclaw-hint')
  const disclaimer = root.querySelector('.rc-composer__disclaimer')
  const newThreadButton = $('#roachclaw-new-thread')
  const sidebar = root.querySelector('.rc-sidebar')
  const sidebarOverlay = root.querySelector('.rc-sidebar-overlay')
  const sidebarToggle = $('#rc-sidebar-toggle')
  const threadTitle = root.querySelector('.rc-main__thread-title')
  const modelBadge = root.querySelector('.rc-model-badge')
  const modelBadgeText = root.querySelector('.rc-model-badge span:last-child')
  const accountChip = $('#roachclaw-account-chip')
  const whoLine = $('#roachclaw-who')
  const hostedLane = root.querySelector('[data-lane="hosted"]')
  const macLane = root.querySelector('[data-lane="mac"]')

  const authGate = $('#roachclaw-auth-gate')
  const authGateCopy = $('#roachclaw-gate-copy')
  const authForm = $('#roachclaw-auth-form')
  const authEmailInput = $('#roachclaw-auth-email')
  const authPasswordInput = $('#roachclaw-auth-password')
  const authSubmit = $('#roachclaw-auth-submit')
  const authSubmitLabel = authSubmit?.querySelector('.rc-submit__label') || authSubmit
  const authFeedback = $('#roachclaw-auth-feedback')
  const emailHint = $('[data-hint-for="email"]')

  const isApple = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')
  const defaultDisclaimer = disclaimer?.textContent?.trim() || ''

  const starterPrompts = {
    explain: 'Explain what RoachNet does on the Mac, on iPhone and in the Apps store, in plain language.',
    draft: 'Help me draft a short message. Ask who it is for, then keep it clear and direct.',
    debug: 'Help me debug something. Ask only the questions you need, then give me the next practical step.',
    summarize: 'Summarize what I paste next so it is quick to scan and easy to act on.',
    cookbook: 'Help me pick a local model for RoachClaw on my Mac. Ask about my chip and memory, then explain the tradeoff plainly.',
    research: 'Plan a research pass on a topic I name: which sources to check, how to verify them, and what the final brief should hold.',
  }

  let authState = null
  let authSubscription = null
  let authBusy = false
  let chatBusy = false
  let threads = []
  let activeThreadId = null
  let messages = []
  let gateTimer = 0

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function renderInlineMarkdown(value) {
    let html = escapeHtml(value)
    const codeSpans = []
    html = html.replace(/`([^`]+)`/g, (_match, code) => {
      const index = codeSpans.push(`<code>${code}</code>`) - 1
      return `@@CODE_SPAN_${index}@@`
    })
    html = html
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noreferrer" target="_blank">$1</a>')
    codeSpans.forEach((span, index) => {
      html = html.replace(`@@CODE_SPAN_${index}@@`, span)
    })
    return html
  }

  const markdownFencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/

  function findStreamingBoundaries(text, fromOffset = 0) {
    const boundaries = []
    let inFence = false
    let fenceMarker = ''
    let index = Math.max(0, Math.min(Number(fromOffset) || 0, text.length))

    while (index < text.length) {
      const newlineIndex = text.indexOf('\n', index)
      const lineEnd = newlineIndex === -1 ? text.length : newlineIndex
      const afterNewline = newlineIndex === -1 ? text.length : newlineIndex + 1
      const line = text.slice(index, lineEnd)
      const fence = line.match(markdownFencePattern)

      if (fence) {
        const marker = fence[1]
        if (!inFence) {
          inFence = true
          fenceMarker = marker
        } else if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length && fence[2].trim() === '') {
          inFence = false
          fenceMarker = ''
          boundaries.push({ offset: afterNewline, afterClosedFence: true })
        }
        index = afterNewline
        continue
      }

      if (!inFence && line.trim() === '') {
        let nextIndex = afterNewline
        while (nextIndex < text.length) {
          const nextNewline = text.indexOf('\n', nextIndex)
          const nextLineEnd = nextNewline === -1 ? text.length : nextNewline
          if (text.slice(nextIndex, nextLineEnd).trim() !== '') break
          if (nextNewline === -1) {
            nextIndex = text.length
            break
          }
          nextIndex = nextNewline + 1
        }
        boundaries.push({ offset: nextIndex, afterClosedFence: false })
        index = nextIndex
        continue
      }

      index = afterNewline
    }

    return boundaries
  }

  function splitMarkdownBlocks(value, { forceFinal = false } = {}) {
    const text = String(value || '')
    if (!text) return []
    const lines = text.split('\n')
    const blocks = []
    let current = []
    let inFence = false
    let fenceMarker = ''
    let fenceClosed = false

    const pushCurrent = (forceFinal = false) => {
      if (!current.length) return
      blocks.push({
        text: current.join('\n'),
        closedFence: fenceClosed,
        forceFinal,
      })
      current = []
      fenceClosed = false
    }

    lines.forEach((line) => {
      const fence = line.match(markdownFencePattern)
      if (fence) {
        const marker = fence[1]
        current.push(line)
        if (!inFence) {
          inFence = true
          fenceMarker = marker
        } else if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length && fence[2].trim() === '') {
          inFence = false
          fenceMarker = ''
          fenceClosed = true
          pushCurrent(true)
        }
        return
      }

      if (!inFence && line.trim() === '') {
        pushCurrent(false)
        return
      }

      current.push(line)
    })

    pushCurrent(false)
    return blocks.map((block, index) => ({
      ...block,
      finalized: forceFinal || block.forceFinal || index < blocks.length - 1,
    }))
  }

  // Code blocks get a small bar with the language and a copy button. The markup is
  // a pure function of the block text, so finalized-vs-joined render comparisons
  // in splitFinalizedMarkdown stay stable.
  function renderCodeBlock(language, code) {
    const lang = escapeHtml(language)
    return `<div class="rc-code"><div class="rc-code__bar"><span>${lang || 'code'}</span><button class="rc-code__copy" type="button" data-rc-copy>Copy</button></div><pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code)}</code></pre></div>`
  }

  function renderMarkdownBlock(block) {
    const text = block.text || ''
    const fence = text.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:\n {0,3}\1\s*)?$/)
    if (fence && (block.closedFence || text.includes('\n'))) {
      const language = fence[2].trim().split(/\s+/)[0] || ''
      return renderCodeBlock(language, fence[3] || '')
    }

    // Message headings sit below the page h1, so Markdown # becomes h2, ## h3, ### h4.
    if (/^#{1,3}\s+/.test(text)) {
      const markdownLevel = Math.min(3, text.match(/^#+/)?.[0]?.length || 1)
      const documentLevel = markdownLevel + 1
      return `<h${documentLevel}>${renderInlineMarkdown(text.replace(/^#{1,3}\s+/, ''))}</h${documentLevel}>`
    }

    const lines = text.split('\n')
    if (lines.length > 1 && lines.every((line) => /^\s*[-*]\s+/.test(line) || line.trim() === '')) {
      const items = lines
        .filter((line) => line.trim())
        .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
        .join('')
      return `<ul>${items}</ul>`
    }

    return `<p>${lines.map((line) => renderInlineMarkdown(line)).join('<br>')}</p>`
  }

  function renderMarkdownSource(value, options = {}) {
    return splitMarkdownBlocks(value, options)
      .map((block) => `<div class="rc-md-block ${block.finalized ? 'is-finalized' : 'is-live'}">${renderMarkdownBlock(block)}</div>`)
      .join('')
  }

  function splitFinalizedMarkdown(text, committedLen = 0) {
    const safeCommittedLen = Math.max(0, Math.min(Number(committedLen) || 0, text.length))
    const boundaries = findStreamingBoundaries(text, safeCommittedLen)
    let best = safeCommittedLen
    let segmentStart = safeCommittedLen

    boundaries.forEach(({ offset, afterClosedFence }, index) => {
      if (afterClosedFence) {
        best = offset
        segmentStart = offset
        return
      }

      const nextOffset = index + 1 < boundaries.length ? boundaries[index + 1].offset : text.length
      const before = text.slice(segmentStart, offset)
      const after = text.slice(offset, nextOffset)
      const separateRender = renderMarkdownSource(before, { forceFinal: true }) + renderMarkdownSource(after)
      const joinedRender = renderMarkdownSource(before + after)

      if (after.trim() && separateRender === joinedRender) {
        best = offset
      }
      segmentStart = offset
    })

    return best
  }

  function describeOpenFence(text) {
    const open = String(text || '').match(/^( {0,3})(`{3,}|~{3,})([^\n]*)\n/)
    if (!open) return null
    const marker = open[2]
    const contentStart = open[0].length

    for (let index = contentStart; index < text.length;) {
      const newlineIndex = text.indexOf('\n', index)
      const line = text.slice(index, newlineIndex === -1 ? text.length : newlineIndex)
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
      if (close && close[1][0] === marker[0] && close[1].length >= marker.length) return null
      if (newlineIndex === -1) break
      index = newlineIndex + 1
    }

    return {
      lang: (open[3] || '').trim().split(/\s+/)[0] || '',
      contentStart,
    }
  }

  function renderStreamingTail(tailText) {
    const openFence = describeOpenFence(tailText)
    if (!openFence) return renderMarkdownSource(tailText)
    const code = tailText.slice(openFence.contentStart)
    return `<div class="rc-md-block is-live" data-open-fence="true">${renderCodeBlock(openFence.lang, code)}</div>`
  }

  function renderMessageContent(message) {
    const isStreamingAssistant = message.role === 'assistant' && message.pending
    const content = String(message.content || '')
    if (!content) return '<div class="rc-message__content"></div>'
    const finalizedLen = isStreamingAssistant ? splitFinalizedMarkdown(content) : content.length
    const finalized = content.slice(0, finalizedLen)
    const tail = content.slice(finalizedLen)
    const body = [
      finalized ? renderMarkdownSource(finalized, { forceFinal: true }) : '',
      tail ? renderStreamingTail(tail) : '',
    ].join('')
    return `<div class="rc-message__content" data-streaming="${isStreamingAssistant ? 'append-only' : 'settled'}" data-finalized-chars="${finalizedLen}">${body}</div>`
  }

  function summarizePrompt(value) {
    const flattened = String(value || '').replace(/\s+/g, ' ').trim()
    if (!flattened) return 'New conversation'
    return flattened.length > 68 ? `${flattened.slice(0, 65)}...` : flattened
  }

  function formatRelativeTime(value) {
    if (!value) return 'Just now'
    const date = new Date(value)
    const diff = date.getTime() - Date.now()
    if (!Number.isFinite(diff)) return ''
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    const minutes = Math.round(diff / 60000)
    if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 48) return formatter.format(hours, 'hour')
    return formatter.format(Math.round(hours / 24), 'day')
  }

  function activeThread() {
    return threads.find((thread) => thread.id === activeThreadId) || null
  }

  function signedIn() {
    return Boolean(authState?.enabled && authState?.session?.user)
  }

  let toastElement = null
  function toast(message) {
    if (!toastElement) {
      toastElement = document.createElement('div')
      toastElement.className = 'nx-toast'
      toastElement.setAttribute('role', 'status')
      toastElement.setAttribute('aria-live', 'polite')
      document.body.append(toastElement)
    }
    toastElement.textContent = message
    toastElement.classList.add('is-on')
    window.clearTimeout(toastElement.timer)
    toastElement.timer = window.setTimeout(() => toastElement.classList.remove('is-on'), 2400)
  }

  function setGateFeedback(message, tone = 'muted') {
    if (!authFeedback) return
    authFeedback.textContent = message || ''
    authFeedback.dataset.tone = tone
  }

  function setComposerFeedback(message, tone = 'muted') {
    if (!disclaimer) return
    disclaimer.textContent = message || defaultDisclaimer
    disclaimer.dataset.tone = message ? tone : 'muted'
  }

  function showGate({ nudge = false } = {}) {
    if (!authGate) return
    window.clearTimeout(gateTimer)
    authGate.hidden = false
    root.classList.add('is-auth-locked')
    authGate.classList.remove('is-leaving')
    requestAnimationFrame(() => {
      authGate.classList.add('is-visible')
      if (nudge) {
        authGate.classList.remove('is-nudged')
        void authGate.offsetWidth
        authGate.classList.add('is-nudged')
        authGate.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' })
      }
    })
  }

  function hideGate() {
    if (!authGate || authGate.hidden) {
      root.classList.remove('is-auth-locked')
      return
    }
    authGate.classList.add('is-leaving')
    authGate.classList.remove('is-visible', 'is-nudged')
    root.classList.remove('is-auth-locked')
    gateTimer = window.setTimeout(() => {
      authGate.hidden = true
      authGate.classList.remove('is-leaving')
    }, reducedMotion.matches ? 0 : 280)
  }

  function setAuthBusy(nextBusy, label) {
    authBusy = nextBusy
    const disabled = Boolean(nextBusy)
    ;[authEmailInput, authPasswordInput, authSubmit, accountChip].forEach((element) => {
      if (element) element.disabled = disabled
    })
    if (authSubmit) {
      authSubmit.classList.toggle('is-loading', disabled && Boolean(label))
      authSubmit.setAttribute('aria-busy', disabled && label ? 'true' : 'false')
    }
    if (authSubmitLabel) authSubmitLabel.textContent = label || 'Sign in'
  }

  function setChatBusy(nextBusy) {
    chatBusy = nextBusy
    if (input) input.disabled = Boolean(nextBusy)
    if (sendButton) {
      sendButton.disabled = Boolean(nextBusy)
      sendButton.classList.toggle('is-busy', Boolean(nextBusy))
    }
    if (newThreadButton) newThreadButton.disabled = Boolean(nextBusy)
    root.classList.toggle('is-chat-busy', Boolean(nextBusy))
  }

  const mobileDrawer = window.matchMedia('(max-width: 900px)')

  function openSidebar() {
    sidebar?.classList.add('is-open')
    sidebarOverlay?.classList.add('is-visible')
    sidebarToggle?.setAttribute('aria-expanded', 'true')
    if (mobileDrawer.matches) {
      window.setTimeout(() => newThreadButton?.focus({ preventScroll: true }), 30)
    }
  }

  function closeSidebar({ restoreFocus = false } = {}) {
    const wasOpen = sidebar?.classList.contains('is-open')
    sidebar?.classList.remove('is-open')
    sidebarOverlay?.classList.remove('is-visible')
    sidebarToggle?.setAttribute('aria-expanded', 'false')
    if (wasOpen && restoreFocus && mobileDrawer.matches) sidebarToggle?.focus()
  }

  function syncInputHeight() {
    if (!input) return
    input.style.height = '0px'
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`
    root.classList.toggle('has-draft', Boolean(input.value.trim()))
  }

  function currentRelay() {
    const lastReply = [...messages].reverse().find((message) => message.role === 'assistant' && !message.pending)
    return /relay|local/i.test(String(lastReply?.provider || '')) ? 'mac' : 'hosted'
  }

  function renderRelay() {
    const relay = currentRelay()
    const live = signedIn()
    if (modelBadge) {
      modelBadge.dataset.relay = relay
      modelBadge.dataset.state = live ? 'live' : 'idle'
    }
    if (modelBadgeText) {
      modelBadgeText.textContent = relay === 'mac' ? 'Your Mac via RoachTail' : 'Hosted model'
    }
    if (hostedLane) {
      hostedLane.dataset.state = live ? (relay === 'hosted' ? 'live' : 'ready') : 'idle'
      const status = hostedLane.querySelector('[data-lane-status]')
      if (status) status.textContent = live ? (relay === 'hosted' ? 'Answering this thread' : 'Ready') : 'Sign in to use it'
    }
    if (macLane) {
      macLane.dataset.state = relay === 'mac' ? 'live' : 'off'
      const status = macLane.querySelector('[data-lane-status]')
      if (status) status.textContent = relay === 'mac' ? 'Answered the last reply' : 'Not connected'
    }
  }

  function renderChrome() {
    const session = authState?.session
    const email = session?.user ? sessionLabel(session) : ''
    if (accountChip) {
      accountChip.textContent = session?.user ? 'Sign out' : 'Sign in'
      accountChip.dataset.state = session?.user ? 'live' : 'ready'
      accountChip.setAttribute('aria-label', session?.user ? `Sign out of ${email}` : 'Sign in to RoachClaw')
      accountChip.title = session?.user ? `Signed in as ${email}` : 'Sign in to send messages'
    }

    if (whoLine) {
      whoLine.textContent = session?.user ? `Signed in as ${email}. ` : 'Not signed in. '
      const link = document.createElement('a')
      link.className = 'nx-link'
      link.href = 'https://accounts.roachnet.org/'
      link.textContent = 'Account'
      whoLine.append(link)
    }

    if (hint) {
      hint.textContent = !authState?.enabled
        ? "Sign-in isn't available here"
        : session?.user
          ? 'Hosted model'
          : 'Sign in to send'
    }

    if (threadTitle) {
      threadTitle.textContent = activeThread()?.title || 'New conversation'
    }

    renderRelay()
  }

  function renderThreadList() {
    if (!threadList) return

    if (!authState?.enabled) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>Sign-in is not switched on for this site yet, so there is nothing to list.</p></div>'
      return
    }

    if (!authState?.session?.user) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>Your saved conversations show up here once you sign in.</p></div>'
      return
    }

    if (!threads.length) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>Nothing saved yet. Your first message starts a thread.</p></div>'
      return
    }

    threadList.innerHTML = threads
      .map((thread) => {
        const isActive = thread.id === activeThreadId
        return `
          <button class="rc-thread-item${isActive ? ' is-active' : ''}" type="button" data-thread-id="${escapeHtml(thread.id)}"${isActive ? ' aria-current="true"' : ''}>
            <strong>${escapeHtml(thread.title || 'New conversation')}</strong>
            <span>${escapeHtml(thread.summary || 'Saved to your account')}</span>
            <small>${escapeHtml(formatRelativeTime(thread.last_message_at || thread.created_at))}</small>
          </button>
        `
      })
      .join('')
  }

  function renderMessages() {
    if (!log) return

    if (!messages.length) {
      log.innerHTML = ''
      log.hidden = true
      if (welcome) welcome.hidden = false
      root.classList.add('is-empty')
      if (scroller) scroller.scrollTop = 0
      renderChrome()
      return
    }

    if (welcome) welcome.hidden = true
    log.hidden = false
    root.classList.remove('is-empty')

    log.innerHTML = messages
      .map((message) => {
        const roleClass =
          message.role === 'user'
            ? 'rc-message--user'
            : message.role === 'assistant'
              ? 'rc-message--assistant'
              : 'rc-message--system'
        const label =
          message.role === 'user'
            ? 'You'
            : message.role === 'assistant'
              ? 'RoachClaw'
              : 'System'
        const meta = message.pending
          ? message.role === 'assistant' ? 'Thinking' : 'Sending'
          : [message.model, message.provider].filter(Boolean).join(' · ') || formatRelativeTime(message.created_at)

        return `
          <article class="rc-message ${roleClass}${message.pending ? ' is-pending' : ''}">
            <header class="rc-message__head">
              ${message.role === 'assistant' ? '<span class="rc-message__avatar" aria-hidden="true"></span>' : ''}
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(meta)}</span>
            </header>
            ${renderMessageContent(message)}
          </article>
        `
      })
      .join('')

    if (scroller) scroller.scrollTop = scroller.scrollHeight
    renderChrome()
  }

  function resetThreadState() {
    threads = []
    activeThreadId = null
    messages = []
    renderThreadList()
    renderMessages()
  }

  async function loadMessages(threadId) {
    if (!authState?.client || !authState?.session?.user || !threadId) {
      messages = []
      renderMessages()
      return
    }

    root.classList.add('is-loading-thread')
    const { data, error } = await authState.client
      .from('chat_messages')
      .select('id, role, content, created_at, provider, model')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    root.classList.remove('is-loading-thread')

    if (error) {
      setComposerFeedback(error.message || 'That conversation would not load. Try again.', 'error')
      return
    }

    messages = data || []
    renderMessages()
  }

  async function loadThreads(preferredThreadId = activeThreadId) {
    if (!authState?.client || !authState?.session?.user) {
      resetThreadState()
      return
    }

    const { data, error } = await authState.client
      .from('chat_threads')
      .select('id, title, summary, last_message_at, created_at')
      .order('last_message_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(40)

    if (error) {
      setComposerFeedback(error.message || 'Your conversations would not load. Try again.', 'error')
      return
    }

    threads = data || []
    activeThreadId =
      (preferredThreadId && threads.some((thread) => thread.id === preferredThreadId) && preferredThreadId) ||
      threads[0]?.id ||
      null

    renderThreadList()

    if (activeThreadId) {
      await loadMessages(activeThreadId)
    } else {
      messages = []
      renderMessages()
    }
  }

  async function createThreadForPrompt(message) {
    const { data, error } = await authState.client
      .from('chat_threads')
      .insert({
        user_id: authState.session.user.id,
        title: summarizePrompt(message),
        summary: null,
        lane: 'roachclaw-web',
        source: window.location.origin + window.location.pathname,
      })
      .select('id, title, summary, last_message_at, created_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || "RoachClaw couldn't start a new conversation. Try again in a moment.")
    }

    threads = [data, ...threads]
    activeThreadId = data.id
    renderThreadList()
    renderChrome()
    return data
  }

  function validateEmail({ quiet = false } = {}) {
    const value = String(authEmailInput?.value || '').trim()
    const valid = Boolean(value) && authEmailInput?.checkValidity() !== false
    const field = authEmailInput?.closest('.rc-field')
    if (!quiet || value) {
      field?.classList.toggle('is-invalid', !valid)
      authEmailInput?.setAttribute('aria-invalid', valid ? 'false' : 'true')
      if (emailHint) emailHint.textContent = valid ? '' : value ? 'That email looks incomplete.' : 'Enter your email.'
    }
    return valid
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (!authState?.enabled || !authState?.client) {
      setGateFeedback('Sign-in is not switched on for this site yet.', 'error')
      return
    }

    const email = String(authEmailInput?.value || '').trim()
    const password = String(authPasswordInput?.value || '')

    if (!validateEmail() || !password) {
      setGateFeedback(!password && email ? 'Enter your password too.' : 'Enter your email and password to continue.', 'error')
      ;(!email ? authEmailInput : authPasswordInput)?.focus()
      return
    }

    setAuthBusy(true, 'Signing in…')
    setGateFeedback('')

    try {
      const result = await authState.client.auth.signInWithPassword({ email, password })
      if (result.error) {
        throw result.error
      }

      authState = {
        ...authState,
        session: result.data?.session || authState.session,
      }

      authForm?.reset()
      setGateFeedback('')
      hideGate()
      renderChrome()
      toast(`Signed in as ${sessionLabel(authState.session)}`)
      await loadThreads()
      input?.focus()
    } catch (error) {
      setGateFeedback(friendlyAuthError(error, 'Sign-in did not go through. Try again.'), 'error')
      authPasswordInput?.select?.()
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    if (!authState?.client || authBusy) return
    setAuthBusy(true)
    await authState.client.auth.signOut()
    clearCachedAuthState()
    authState = {
      ...authState,
      session: null,
    }
    setAuthBusy(false)
    renderAuthState()
    resetThreadState()
    toast('Signed out')
  }

  async function handleSend() {
    if (chatBusy) return
    const message = String(input?.value || '').trim()

    if (!signedIn()) {
      showGate({ nudge: true })
      setGateFeedback(
        authState?.enabled === false
          ? 'Sign-in is not switched on for this site yet.'
          : message
            ? 'Sign in to send that. Your draft stays put.'
            : 'Sign in to start a conversation.',
        authState?.enabled === false ? 'error' : 'muted'
      )
      if (authState?.enabled !== false) authEmailInput?.focus({ preventScroll: true })
      return
    }

    if (!message) {
      setComposerFeedback('Type a message first.', 'error')
      input?.focus()
      return
    }

    const accessToken = authState.session.access_token
    if (!accessToken) {
      setComposerFeedback('Your session expired. Sign in again to keep going.', 'error')
      return
    }

    const previousMessages = [...messages]
    const previousThreadId = activeThreadId
    const optimisticTimestamp = new Date().toISOString()

    setChatBusy(true)
    setComposerFeedback('Sending…')

    try {
      if (!activeThreadId) {
        await createThreadForPrompt(message)
      }

      messages = [
        ...previousMessages,
        {
          id: `local-user-${crypto.randomUUID()}`,
          role: 'user',
          content: message,
          created_at: optimisticTimestamp,
          pending: true,
        },
        {
          id: `local-assistant-${crypto.randomUUID()}`,
          role: 'assistant',
          content: 'RoachClaw is thinking…',
          created_at: optimisticTimestamp,
          pending: true,
        },
      ]

      if (input) {
        input.value = ''
        syncInputHeight()
      }
      renderMessages()

      // A cold hosted model answers 503 "warming" before anything is written;
      // try again twice while it finishes loading.
      let response
      let payload
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(authState.config?.webChat?.endpoint || '/.netlify/functions/roachclaw-chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            threadId: activeThreadId,
            message,
          }),
        })
        payload = await response.json().catch(() => ({}))
        if (response.status !== 503 || payload?.code !== 'warming' || attempt === 2) break
        setComposerFeedback('RoachClaw on the web is waking up. Sending again in a few seconds…')
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || "RoachClaw couldn't finish that reply. Your earlier messages are fine. Try again in a moment.")
      }

      activeThreadId = payload.thread?.id || activeThreadId
      if (payload.assistantMessage?.content) {
        messages = messages.map((entry) => {
          if (entry.role === 'assistant' && entry.pending) {
            return {
              ...payload.assistantMessage,
              pending: false,
            }
          }
          if (entry.role === 'user' && entry.pending && payload.userMessage) {
            return {
              ...payload.userMessage,
              pending: false,
            }
          }
          return entry
        })
        renderMessages()
      }
      setComposerFeedback(
        `Reply from ${payload.provider || 'RoachBrain Cloud'} · ${payload.model || authState.config?.webChat?.modelLabel || 'Hosted model'}`,
        'live'
      )
      await loadThreads(activeThreadId)
    } catch (error) {
      messages = previousMessages
      activeThreadId = previousThreadId || activeThreadId
      renderMessages()
      if (input) {
        input.value = message
        syncInputHeight()
      }
      const reason = String(error?.message || '')
      setComposerFeedback(
        /failed to fetch|networkerror|load failed/i.test(reason)
          ? 'Could not reach RoachClaw. Your message is back in the box, so try again in a moment.'
          : reason || "RoachClaw couldn't finish that reply. Your earlier messages are fine. Try again in a moment.",
        'error'
      )
    } finally {
      setChatBusy(false)
      input?.focus({ preventScroll: true })
    }
  }

  function renderAuthState() {
    const enabled = authState?.enabled === true
    const session = authState?.session

    if (!enabled) {
      if (authGateCopy) {
        authGateCopy.textContent = authState?.reason || 'Sign-in is not switched on for this site yet.'
      }
      setGateFeedback('Sign-in is not available here yet.', 'error')
      showGate()
      setAuthBusy(true)
      setComposerFeedback("Sign-in isn't available here, so messages can't be sent. RoachClaw in the Mac app doesn't need an account.", 'error')
      renderChrome()
      return
    }

    setAuthBusy(false)
    renderChrome()

    if (session?.user) {
      hideGate()
      setComposerFeedback('')
      return
    }

    if (authGateCopy) {
      authGateCopy.textContent =
        'Sign in to send messages and pick up old threads from any browser. Your models and files stay on your Mac either way.'
    }
    showGate()
    setComposerFeedback('')
  }

  async function initializeAuthState() {
    authSubscription?.unsubscribe?.()
    authSubscription = null

    try {
      authState = await getSiteAuthState()
    } catch (error) {
      authState = { enabled: false, client: null, session: null, reason: error?.message || 'The sign-in library did not load.' }
    }
    root.classList.remove('is-booting')
    renderAuthState()

    if (authState?.enabled && authState?.client) {
      const { data } = authState.client.auth.onAuthStateChange(async (_event, session) => {
        const changedUser = (session?.user?.id || '') !== (authState?.session?.user?.id || '')
        authState = {
          ...authState,
          session,
        }
        renderAuthState()

        if (!changedUser) return
        if (session?.user) {
          await loadThreads(activeThreadId)
        } else {
          resetThreadState()
        }
      })
      authSubscription = data?.subscription || null
    }

    if (authState?.session?.user) {
      await loadThreads()
    } else {
      resetThreadState()
    }
  }

  function startNewConversation() {
    if (chatBusy) return
    activeThreadId = null
    messages = []
    renderThreadList()
    renderMessages()
    setComposerFeedback(signedIn() ? 'New conversation. Say something.' : '')
    closeSidebar()
    input?.focus()
  }

  // ---- Event wiring --------------------------------------------------------

  authForm?.addEventListener('submit', handleAuthSubmit)
  authEmailInput?.addEventListener('blur', () => validateEmail({ quiet: true }))
  authEmailInput?.addEventListener('input', () => {
    if (authEmailInput.closest('.rc-field')?.classList.contains('is-invalid')) validateEmail({ quiet: true })
  })

  accountChip?.addEventListener('click', async () => {
    if (authState?.session?.user) {
      await handleSignOut()
      return
    }
    showGate({ nudge: true })
    authEmailInput?.focus({ preventScroll: true })
  })

  newThreadButton?.addEventListener('click', startNewConversation)
  sendButton?.addEventListener('click', () => void handleSend())

  welcome?.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.rc-starter-card') : null
    if (!button || !input) return
    const prompt = starterPrompts[button.dataset.starter || ''] || button.querySelector('strong')?.textContent?.trim() || ''
    if (!prompt) return
    input.value = prompt
    syncInputHeight()
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })

  threadList?.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-thread-id]') : null
    if (!button) return
    const threadId = button.dataset.threadId || ''
    closeSidebar()
    if (!threadId || threadId === activeThreadId) return
    activeThreadId = threadId
    renderThreadList()
    renderChrome()
    await loadMessages(threadId)
  })

  log?.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-rc-copy]') : null
    if (!button) return
    const code = button.closest('.rc-code')?.querySelector('pre code')?.textContent || ''
    try {
      await navigator.clipboard.writeText(code)
      button.textContent = 'Copied'
      button.classList.add('is-done')
      toast('Code copied')
    } catch {
      button.textContent = 'Select to copy'
    }
    window.setTimeout(() => {
      button.textContent = 'Copy'
      button.classList.remove('is-done')
    }, 1600)
  })

  input?.addEventListener('input', syncInputHeight)
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      void handleSend()
    }
  })

  sidebarToggle?.addEventListener('click', () => {
    if (sidebar?.classList.contains('is-open')) closeSidebar({ restoreFocus: true })
    else openSidebar()
  })
  sidebarOverlay?.addEventListener('click', () => closeSidebar({ restoreFocus: true }))
  mobileDrawer.addEventListener?.('change', () => closeSidebar())

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      startNewConversation()
      return
    }
    if (event.key === 'Escape' && sidebar?.classList.contains('is-open')) {
      closeSidebar({ restoreFocus: true })
    }
  })

  if (!isApple) {
    root.querySelectorAll('[data-rc-mod]').forEach((key) => {
      key.textContent = 'Ctrl'
    })
  }

  window.addEventListener('beforeunload', () => {
    authSubscription?.unsubscribe?.()
  })

  root.classList.add('is-booting', 'is-empty')
  if (log) log.hidden = true
  syncInputHeight()
  void initializeAuthState()
}
