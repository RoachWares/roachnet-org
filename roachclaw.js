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
            <p>${escapeHtml(message.content)}</p>
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
