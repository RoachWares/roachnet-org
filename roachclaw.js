import {
  clearCachedAuthState,
  getSiteAuthState,
  refreshSiteSession,
  sessionLabel,
} from './site-account.js'

const root = document.querySelector('#view-roachclaw')

if (root) {
  const $ = (selector) => root.querySelector(selector)

  const threadList = $('#roachclaw-thread-list')
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
  const modelBadgeText = root.querySelector('.rc-model-badge span')
  const accountChip = $('#roachclaw-account-chip')

  const authGate = $('#roachclaw-auth-gate')
  const authGateCopy = $('#roachclaw-gate-copy')
  const authForm = $('#roachclaw-auth-form')
  const authNameField = $('#roachclaw-auth-name-field')
  const authNameInput = $('#roachclaw-auth-name')
  const authEmailInput = $('#roachclaw-auth-email')
  const authPasswordInput = $('#roachclaw-auth-password')
  const authSubmit = $('#roachclaw-auth-submit')
  const authNote = $('#roachclaw-auth-note')
  const authFeedback = $('#roachclaw-auth-feedback')
  const authModeButtons = [...root.querySelectorAll('[data-roachclaw-auth-mode]')]

  const emptyStateTemplate = log?.innerHTML || ''
  const starterPrompts = {
    explain: 'Explain what RoachNet can do across desktop, iOS, and the Apps store in plain language.',
    draft: 'Draft a concise message I can send from RoachNet. Keep it clean, direct, and practical.',
    debug: 'Help me debug a problem in my RoachNet stack. Ask the minimum questions you need and give me practical next steps.',
    summarize: 'Summarize the important parts of this topic in a way that is fast to scan and act on.',
    cookbook: 'Run a RoachClaw Cookbook check. Ask about the machine if you need to, recommend the model lane that fits, and explain the tradeoff without hardware theater.',
    research: 'Plan a deep research run. Name the source types, the verification pass, and the final brief I should save to the vault.',
    compare: 'Compare two model routes on the same prompt. Hide the labels until after scoring accuracy, clarity, speed, and local suitability.',
    memory: 'Run a RoachBrain audit. Find stale context, useful procedures, and one cleanup move that will make future prompts sharper.',
    skills: 'Turn this successful workflow into a RoachClaw skill. Give it a name, trigger hints, guardrails, and the exact steps worth saving.',
    searchcache: 'Plan a local search cache entry. Capture the query, source list, ranking notes, and the summary RoachNet should keep for later.',
    drafts: 'Stage this as a native editor draft. Pick the format, title, target shelf, and the next edit that makes it worth saving.',
    webhooks: 'Review a local webhook setup. Name the scope, secret-handling rule, trigger path, and the approval gate before anything runs.',
    commanddeck: 'Design the RoachNet command deck for this workflow. Include the search phrase, preview panel, approval boundary, and what should happen on Ctrl-Cmd-R.',
    contextrail: 'Build a contextual side rail for this task. List visible files, memories, compactions, search crumbs, and the one thing RoachClaw should not touch.',
    vaultnav: 'Plan a Finder-like vault navigation pass. Name the shelves, previews, drag-and-drop imports, and reveal-in-Finder behavior that should exist.',
    agentmonitor: 'Design an Activity Monitor-style agent view. Show active runs, stalled work, replay crumbs, resource pressure, and stop/retry actions.',
    orchestration: 'Shape a multi-agent orchestration board. Assign roles, context budgets, handoffs, stop conditions, and the final evidence bundle.',
    sessionboard: 'Design a RoachClaw session board. Include chat history, detached run replay, transcript save/export, context restore, and branch resume behavior.',
    modelbench: 'Design a native model bench. Include fit scoring, blind comparison, serve plans, saved winners, and the model-pack route users should see next.',
    themestudio: 'Design the RoachNet theme studio. Cover palette, density, motion, contrast, and safe export without turning settings into a junk drawer.',
    agentruns: 'Plan a detached RoachClaw agent run. Name the session, status, replay crumbs, stop condition, and what should survive a closed browser tab.',
    compactions: 'Create a context compaction note. Preserve goals, file paths, decisions, blockers, and the next move without hauling the whole chat around.',
    streamingstability: 'Audit RoachClaw streaming stability. Cover append-only chunks, finalized markdown boundaries, open code fences, fallback rendering, and how hosted chat should avoid rewriting settled text.',
    toolindex: 'Design a local RoachClaw tool index entry. Include the tool name, category, trigger hints, safety boundary, and when it should always be available.',
    events: 'Set up a local RoachClaw event counter. Name the event, trigger threshold, owner scope, and the action that should fire when it earns it.',
    documents: 'Help with a vault document. Summarize it, suggest edits, name the missing context, and give me the version worth saving.',
    inbox: 'Plan a local-first inbox triage pass. Sort urgency, draft one reply, and list what should become a reminder instead of another unread email.',
    calendar: 'Turn these notes into a sane schedule. Keep the plan local-first, include reminders, and avoid calendar theater.',
    gallery: 'Plan a media cleanup lane. Import, tag, dedupe, and export the useful assets without creating a second junk drawer.',
    diagnostics: 'Run a RoachNet diagnostics pass. Check provider probes, degraded services, settings that need scrubbing, and one safe next fix.',
    servicehealth: 'Run the RoachNet service health report. Check Ollama, native agent, memory, embeddings, intake policy, scoped tools, updates, and catalog health. Keep the report secret-safe and point me at the first local fix.',
    integrations: 'Review contacts, webhooks, provider routes, and external handoffs. Flag anything that should stay local, scoped, or disabled.',
    reports: 'Plan a visual report and background job lane. Name the sources, the evidence, the output artifact, and how it should be saved to the vault.',
    presets: 'Design a RoachClaw preset for this workflow. Include the system prompt, model behavior, context lanes, and the guardrails that keep it useful.',
    signatures: 'Create a local signature lane plan for documents, vault notes, and RoachMail. Keep payloads local and name the UI needed to make it painless.',
    backups: 'Plan a RoachClaw backup and restore pass. Include what to export, what to redact, how to verify it, and how to avoid copying secrets by accident.',
    tokens: 'Review the local API token lane. Define scopes, rotation, one-time display rules, and the places plaintext should never be stored.',
    scopedtools: 'Audit RoachClaw scoped tools. List the read, write, launch, document, calendar, memory, and mail scopes; name the approval gate; and flag anything too broad.',
    providersecurity: 'Review provider security for a local-first setup. Cover scoped TLS bundles, upload limits, OAuth handoffs, URL safety, and what must never be exported.',
    uploadpolicy: 'Design RoachNet intake limits. Cover chat attachments, vault imports, gallery media, RoachSpeech audio, calendar files, downloads, env overrides, and the public 413 messages users should actually understand.',
    memoryprovider: 'Design the memory provider lane. Keep RoachBrain native memory as the default, then describe how an external provider can opt in without becoming invisible custody.',
  }

  let authState = null
  let authSubscription = null
  let authMode = 'signin'
  let authBusy = false
  let chatBusy = false
  let threads = []
  let activeThreadId = null
  let messages = []

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

  function renderMarkdownBlock(block) {
    const text = block.text || ''
    const fence = text.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:\n {0,3}\1\s*)?$/)
    if (fence && (block.closedFence || text.includes('\n'))) {
      const language = fence[2].trim().split(/\s+/)[0] || ''
      return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(fence[3] || '')}</code></pre>`
    }

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

    const language = openFence.lang
    const code = tailText.slice(openFence.contentStart)
    return `<div class="rc-md-block is-live" data-open-fence="true"><pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code)}</code></pre></div>`
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

  function summarizeReply(value) {
    const flattened = String(value || '').replace(/\s+/g, ' ').trim()
    if (!flattened) return ''
    return flattened.length > 180 ? `${flattened.slice(0, 177)}...` : flattened
  }

  function formatRelativeTime(value) {
    if (!value) return 'Fresh'
    const date = new Date(value)
    const diff = date.getTime() - Date.now()
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

  function setGateFeedback(message, tone = 'muted') {
    if (!authFeedback) return
    authFeedback.textContent = message || ''
    authFeedback.dataset.tone = tone
  }

  function setComposerFeedback(message, tone = 'muted') {
    if (!disclaimer) return
    disclaimer.textContent = message || ''
    disclaimer.dataset.tone = tone
  }

  function setAuthMode(nextMode) {
    authMode = nextMode === 'signup' ? 'signup' : 'signin'
    authModeButtons.forEach((button) => {
      const isActive = button.dataset.roachclawAuthMode === authMode
      button.classList.toggle('is-active', isActive)
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', isActive ? 'true' : 'false')
      button.tabIndex = isActive ? 0 : -1
    })

    if (authNameField) {
      authNameField.hidden = authMode !== 'signup'
    }

    if (authPasswordInput) {
      authPasswordInput.autocomplete = authMode === 'signup' ? 'new-password' : 'current-password'
    }

    if (authSubmit) {
      authSubmit.textContent = authMode === 'signup' ? 'Create account' : 'Sign in'
    }

    if (authNote) {
      authNote.textContent =
        authMode === 'signup'
          ? 'Create the account that owns your RoachClaw threads.'
          : 'Use the same account that owns your RoachClaw threads.'
    }

    setGateFeedback('')
  }

  function showGate() {
    if (!authGate) return
    authGate.hidden = false
    root.classList.add('is-auth-locked')
    authGate.classList.remove('is-leaving')
    requestAnimationFrame(() => {
      authGate.classList.add('is-visible')
    })
  }

  function hideGate() {
    if (!authGate) return
    authGate.classList.add('is-leaving')
    authGate.classList.remove('is-visible')
    root.classList.remove('is-auth-locked')
    window.setTimeout(() => {
      authGate.hidden = true
      authGate.classList.remove('is-leaving')
    }, 320)
  }

  function setAuthBusy(nextBusy) {
    authBusy = nextBusy
    const disabled = Boolean(nextBusy)
    ;[authNameInput, authEmailInput, authPasswordInput, authSubmit, accountChip].forEach((element) => {
      if (element) element.disabled = disabled
    })
  }

  function setChatBusy(nextBusy) {
    chatBusy = nextBusy
    const disabled = Boolean(nextBusy || !authState?.session?.user)
    if (input) input.disabled = disabled
    if (sendButton) sendButton.disabled = disabled
    if (newThreadButton) newThreadButton.disabled = Boolean(nextBusy || !authState?.session?.user)
  }

  function closeSidebar() {
    sidebar?.classList.remove('is-open')
    sidebarOverlay?.classList.remove('is-visible')
  }

  function syncInputHeight() {
    if (!input) return
    input.style.height = '0px'
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`
  }

  function renderChrome() {
    const session = authState?.session
    if (accountChip) {
      accountChip.textContent = session?.user ? sessionLabel(session) : 'Sign in'
      accountChip.dataset.state = session?.user ? 'live' : 'ready'
      accountChip.title = session?.user ? 'Click to sign out.' : 'Sign in to use RoachClaw.'
    }

    if (modelBadgeText) {
      modelBadgeText.textContent = session?.user ? 'Hosted web lane' : 'Auth required'
    }

    if (hint) {
      hint.textContent = session?.user ? 'Web lane · hosted models' : 'Sign in to chat'
    }

    if (threadTitle) {
      threadTitle.textContent = activeThread()?.title || 'New conversation'
    }
  }

  function renderThreadList() {
    if (!threadList) return

    if (!authState?.enabled) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>This deploy does not have RoachClaw auth armed yet.</p></div>'
      return
    }

    if (!authState?.session?.user) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>Sign in to load the threads tied to your account.</p></div>'
      return
    }

    if (!threads.length) {
      threadList.innerHTML = '<div class="rc-thread-empty"><p>No saved threads yet. Start the first one from the composer.</p></div>'
      return
    }

    threadList.innerHTML = threads
      .map(
        (thread) => `
          <button class="rc-thread-item${thread.id === activeThreadId ? ' is-active' : ''}" type="button" data-thread-id="${thread.id}">
            <strong>${escapeHtml(thread.title || 'New conversation')}</strong>
            <span>${escapeHtml(thread.summary || 'Account-owned RoachClaw thread.')}</span>
            <small>${escapeHtml(formatRelativeTime(thread.last_message_at || thread.created_at))}</small>
          </button>
        `
      )
      .join('')

    threadList.querySelectorAll('[data-thread-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const threadId = button.dataset.threadId || ''
        if (!threadId || threadId === activeThreadId) return
        activeThreadId = threadId
        renderThreadList()
        renderChrome()
        closeSidebar()
        await loadMessages(threadId)
      })
    })
  }

  function starterPromptFor(button) {
    const starterKey = button.dataset.starter || ''
    return starterPrompts[starterKey] || button.querySelector('strong')?.textContent?.trim() || ''
  }

  function bindStarterButtons() {
    log?.querySelectorAll('.rc-starter-card').forEach((button) => {
      button.addEventListener('click', () => {
        const prompt = starterPromptFor(button)
        if (!prompt || !input) return
        input.value = prompt
        syncInputHeight()
        input.focus()
      })
    })
  }

  function renderMessages() {
    if (!log) return

    if (!messages.length) {
      log.innerHTML = emptyStateTemplate
      bindStarterButtons()
      renderChrome()
      return
    }

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
        const meta = [message.model, message.provider].filter(Boolean).join(' · ') || formatRelativeTime(message.created_at)

        return `
          <article class="rc-message ${roleClass}${message.pending ? ' is-pending' : ''}">
            <header>
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(meta)}</span>
            </header>
            ${renderMessageContent(message)}
          </article>
        `
      })
      .join('')

    log.scrollTop = log.scrollHeight
    renderChrome()
  }

  function resetThreadState() {
    threads = []
    activeThreadId = null
    messages = []
    renderThreadList()
    renderMessages()
    renderChrome()
  }

  async function loadMessages(threadId) {
    if (!authState?.client || !authState?.session?.user || !threadId) {
      messages = []
      renderMessages()
      return
    }

    const { data, error } = await authState.client
      .from('chat_messages')
      .select('id, role, content, created_at, provider, model')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) {
      setComposerFeedback(error.message || 'Could not load that thread.', 'error')
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
      setComposerFeedback(error.message || 'Could not load your threads.', 'error')
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
      throw new Error(error?.message || 'Could not create a RoachClaw thread.')
    }

    threads = [data, ...threads]
    activeThreadId = data.id
    renderThreadList()
    renderChrome()
    return data
  }

  async function registerAccount({ email, password, displayName }) {
    const registerUrl = authState?.config?.auth?.registerUrl || 'https://roachnet.org/.netlify/functions/register-account'
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        company: '',
        startedAt: String(Date.now()),
      }),
    })

    const result = await response.json().catch(() => ({
      ok: false,
      message: 'The account service returned unreadable data.',
    }))

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || 'Account creation failed.')
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (!authState?.enabled || !authState?.client) {
      setGateFeedback('This deploy does not have live auth enabled.', 'error')
      return
    }

    const email = String(authEmailInput?.value || '').trim()
    const password = String(authPasswordInput?.value || '')
    const displayName = String(authNameInput?.value || '').trim()

    if (!email || !password) {
      setGateFeedback('Enter both email and password.', 'error')
      return
    }

    setAuthBusy(true)
    setGateFeedback(authMode === 'signup' ? 'Creating account…' : 'Signing in…')

    try {
      if (authMode === 'signup') {
        await registerAccount({ email, password, displayName })
      }

      const result = await authState.client.auth.signInWithPassword({ email, password })
      if (result.error) {
        throw result.error
      }

      authState = {
        ...authState,
        session: result.data?.session || authState.session,
      }

      setGateFeedback(authMode === 'signup' ? 'Account created and signed in.' : 'Signed in.', 'live')
      hideGate()
      renderChrome()
      await loadThreads()
    } catch (error) {
      setGateFeedback(error?.message || 'Sign-in did not finish cleanly.', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    if (!authState?.client || authBusy) return
    setAuthBusy(true)
    setGateFeedback('Signing out…')
    await authState.client.auth.signOut()
    clearCachedAuthState()
    authState = {
      ...authState,
      session: null,
    }
    renderAuthState()
    resetThreadState()
    setAuthBusy(false)
  }

  async function handleSend() {
    if (!authState?.enabled || !authState?.session?.user) {
      showGate()
      authEmailInput?.focus()
      return
    }

    const message = String(input?.value || '').trim()
    if (!message) {
      setComposerFeedback('Enter a prompt first.', 'error')
      return
    }

    const accessToken = authState.session.access_token
    if (!accessToken) {
      setComposerFeedback('This session is missing its access token. Sign in again.', 'error')
      return
    }

    const previousMessages = [...messages]
    const previousThreadId = activeThreadId
    const optimisticTimestamp = new Date().toISOString()

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

    setChatBusy(true)
    setComposerFeedback('Sending through the hosted RoachClaw lane…')
    renderMessages()

    try {
      const response = await fetch(authState.config?.webChat?.endpoint || '/.netlify/functions/roachclaw-chat', {
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

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || 'RoachClaw could not finish the request.')
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
      activeThreadId = previousThreadId
      renderMessages()
      if (input) {
        input.value = message
        syncInputHeight()
      }
      setComposerFeedback(error?.message || 'RoachClaw could not finish the request.', 'error')
    } finally {
      setChatBusy(false)
    }
  }

  function renderAuthState() {
    const enabled = authState?.enabled === true
    const session = authState?.session

    if (!enabled) {
      if (authGateCopy) {
        authGateCopy.textContent = authState?.reason || 'This deploy does not have account auth armed yet.'
      }
      setGateFeedback('This deploy cannot sign in yet.', 'error')
      showGate()
      setAuthBusy(true)
      setComposerFeedback(authState?.reason || 'Account auth is not armed on this deploy yet.', 'error')
      renderChrome()
      setChatBusy(true)
      return
    }

    setAuthBusy(false)
    setChatBusy(false)
    renderChrome()

    if (session?.user) {
      hideGate()
      setComposerFeedback('RoachClaw is ready.', 'live')
      return
    }

    if (authGateCopy) {
      authGateCopy.textContent =
        'Threads follow your account. Your machine state stays on the Mac unless you deliberately pair RoachNet later.'
    }
    setGateFeedback('')
    showGate()
    setComposerFeedback('Sign in to use your account-scoped threads.', 'muted')
  }

  async function initializeAuthState() {
    authSubscription?.unsubscribe?.()
    authSubscription = null

    authState = await getSiteAuthState()
    renderAuthState()

    if (authState?.enabled && authState?.client) {
      const { data } = authState.client.auth.onAuthStateChange(async (_event, session) => {
        authState = {
          ...authState,
          session,
        }
        renderAuthState()

        if (session?.user) {
          await loadThreads(activeThreadId)
        } else {
          resetThreadState()
        }
      })
      authSubscription = data.subscription
    }

    if (authState?.session?.user) {
      await loadThreads()
    } else {
      resetThreadState()
    }
  }

  authModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (authBusy) return
      setAuthMode(button.dataset.roachclawAuthMode)
    })
  })

  authForm?.addEventListener('submit', handleAuthSubmit)

  accountChip?.addEventListener('click', async () => {
    if (authState?.session?.user) {
      await handleSignOut()
      return
    }
    showGate()
    authEmailInput?.focus()
  })

  newThreadButton?.addEventListener('click', () => {
    activeThreadId = null
    messages = []
    renderThreadList()
    renderMessages()
    setComposerFeedback('Fresh thread ready.', 'muted')
    input?.focus()
    closeSidebar()
  })

  sendButton?.addEventListener('click', handleSend)

  input?.addEventListener('input', syncInputHeight)
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  })

  if (window.location.hostname !== 'accounts.roachnet.org') {
    sidebarToggle?.addEventListener('click', () => {
      sidebar?.classList.toggle('is-open')
      sidebarOverlay?.classList.toggle('is-visible')
    })
    sidebarOverlay?.addEventListener('click', closeSidebar)
  }

  window.addEventListener('beforeunload', () => {
    authSubscription?.unsubscribe?.()
  })

  setAuthMode(authMode)
  syncInputHeight()
  void initializeAuthState()
}
