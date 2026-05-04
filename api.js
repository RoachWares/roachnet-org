const apiGroups = [
  {
    id: 'setup',
    label: 'Setup API',
    scope: 'setup',
    basePath: '/api',
    summary: 'Stages contained installs before the full runtime exists.',
    stack: 'Setup server -> run-roachnet-setup.mjs -> staged install + portable embedded Node runtime + bundled runtime helpers',
    callers: ['RoachNet Setup.app'],
    endpoints: [
      {
        id: 'setup-state',
        method: 'GET',
        path: '/state',
        title: 'Installer state',
        summary: 'Returns machine state, saved setup choices, Docker preference, and active task state.',
        handler: 'getInstallerState',
        request: [
          'Query: installPath, installedAppPath, sourceMode, sourceRepoUrl, sourceRef',
          'Flags: installRoachClaw, useDockerContainerization, autoLaunch, autoCheckUpdates, launchAtLogin, dryRun',
          'Options: roachClawDefaultModel, releaseChannel, updateBaseUrl, installPath, storagePath',
        ],
        response: [
          'system, config, installPath, nativeApp, installLooksReady',
          'containerRuntime, dependencies, activeTask, lastCompletedTask, sourceModes',
        ],
        implementation:
          'Normalizes installer config, probes bundled-vs-host dependency state, checks the optional Docker runtime path, and merges persisted installer settings before the setup UI paints. The setup app now boots this state route through a self-contained embedded Node runtime so the first screen does not depend on Homebrew-provided dylibs being present on the host Mac.',
        usedBy: ['Setup overview screen', 'Install-path editor', 'Dependency readiness cards', 'Docker opt-in toggle'],
      },
      {
        id: 'setup-install',
        method: 'POST',
        path: '/install',
        title: 'Start install workflow',
        summary: 'Starts the staged contained install and native-app handoff task.',
        handler: 'handleInstallRequest',
        request: [
          'Body: installer config payload from the setup UI',
          'Supports dryRun preview mode for non-executing install previews',
        ],
        response: ['JSON: { ok: true } or { ok: true, task } in dryRun mode', '409 if a setup task is already running'],
        implementation:
          'Validates that no other setup task is active, stages the install in the user-selected RoachNet install path, copies the bundled source tree, links or stages contained OpenClaw and Ollama into that same RoachNet root, installs the bundled native app from InstallerAssets, smoke-tests /api/health, then promotes the staged tree or removes it on failure. The embedded setup runtime is packaged from the official portable Node build instead of a Homebrew-linked host binary, so the installer can boot on a clean Apple Silicon Mac without reaching into /opt/homebrew. Heavy AI payload hydration is deferred when needed so the installer can finish the real app handoff instead of stalling on a giant first-run model job.',
        usedBy: ['Primary install button in Setup.app'],
      },
      {
        id: 'setup-container-runtime-start',
        method: 'POST',
        path: '/container-runtime/start',
        title: 'Start container runtime',
        summary: 'Boots the optional Docker-backed runtime path for setup.',
        handler: 'handleContainerRuntimeStartRequest',
        request: ['No body required'],
        response: ['JSON: { ok: true, runtime }', '400 on runtime bootstrap failure'],
        implementation:
          'Calls the runtime starter used by setup when the user opts into Docker-backed support services instead of the default contained local runtime.',
        usedBy: ['Setup dependency/runtime stage'],
      },
      {
        id: 'setup-config',
        method: 'POST',
        path: '/config',
        title: 'Persist installer config',
        summary: 'Writes setup choices without starting the install.',
        handler: 'handleConfigRequest',
        request: ['Body: partial installer config payload'],
        response: ['JSON: { ok: true, config }'],
        implementation:
          'Runs the same config normalization as install, then persists the result so setup can resume cleanly across install path, storage path, Docker, and RoachClaw choices.',
        usedBy: ['Install-path chooser', 'Storage-path chooser', 'RoachClaw toggles', 'Docker toggle'],
      },
      {
        id: 'setup-launch',
        method: 'POST',
        path: '/launch',
        title: 'Launch RoachNet after setup',
        summary: 'Opens the native app or falls back to the installed runtime launcher.',
        handler: 'handleLaunchRequest',
        request: ['Body: installPath and optional installedAppPath'],
        response: ['JSON: { ok: true, launched: "native-app", installedAppPath } or { ok: true }'],
        implementation:
          'Prefers the native installed app when present, otherwise launches the installed RoachNet runtime entry script and records the last-opened mode.',
        usedBy: ['Finish / launch step in Setup.app'],
      },
    ],
  },
  {
    id: 'homebrew-lane',
    label: 'Homebrew Install',
    scope: 'packaging',
    basePath: '/brew',
    summary: 'Direct cask install for Apple Silicon Macs that bypasses Setup.app but lands on the same runtime API after boot.',
    stack: 'homebrew-roachnet cask -> postflight config writer -> ~/RoachNet/app/RoachNet.app -> run-roachnet.mjs contained runtime bootstrap',
    callers: ['brew update && brew tap --force AHGRoach/roachnet && brew install --cask roachnet', 'RoachNet-Homebrew.command', 'RoachNet.app first launch after cask install'],
    endpoints: [
      {
        id: 'brew-install-contract',
        method: 'GET',
        path: '/install',
        title: 'Homebrew install contract',
        summary: 'Documents what the cask writes before the native shell ever opens.',
        handler: 'homebrew-roachnet Cask postflight',
        request: ['No HTTP body. This is a packaging/bootstrap contract, not a live runtime route.'],
        response: [
          'App target: ~/RoachNet/app/RoachNet.app',
          'Storage root: ~/RoachNet/storage',
          'Local tools root: ~/RoachNet/bin',
          'Config writes: ~/Library/Application Support/roachnet/roachnet-installer.json and ~/.roachnet-setup.json',
        ],
        implementation:
          'The cask copies the bundled native app out of the DMG, clears the launch-blocking quarantine and provenance flags on the app boundary and executable path without recursively walking the embedded runtime, creates the contained storage/bin roots, and writes the same installer config the native shell expects so the Homebrew install can skip Setup.app completely.',
        usedBy: ['Homebrew postflight hook', 'roachnet.org/brew docs page'],
      },
      {
        id: 'brew-first-boot-defaults',
        method: 'GET',
        path: '/defaults',
        title: 'Homebrew first-boot defaults',
        summary: 'Describes the safer first-launch settings used by the cask install.',
        handler: 'Cask config payload',
        request: ['No HTTP body. Static documentation for the Homebrew bootstrap payload.'],
        response: [
          'useDockerContainerization: false',
          'installProfile: "homebrew-cask"',
          'bootstrapPending: true',
          'bootstrapFailureCount: 0',
          'companionEnabled: false',
          'pendingLaunchIntro: false',
          'pendingRoachClawSetup: true',
          'lastRuntimeHealthAt: null',
        ],
        implementation:
          'The direct cask install comes up with an explicit Homebrew install profile, marks the first launch as pending bootstrap, keeps the companion bridge off, and skips the launch-intro sheet so a fresh Mac can reach a stable runtime before pairing or extra bridge services are enabled.',
        usedBy: ['RoachNet.app first boot after Homebrew install', 'Homebrew troubleshooting docs'],
      },
      {
        id: 'brew-runtime-layout',
        method: 'GET',
        path: '/runtime',
        title: 'Contained Homebrew runtime',
        summary: 'Explains where the compiled runtime is staged and how it differs from the standard setup path.',
        handler: 'run-roachnet.mjs build-runtime bootstrap',
        request: ['No HTTP body. Static documentation for the contained runtime layout.'],
        response: [
          'Compiled runtime cache: ~/RoachNet/storage/state/runtime-cache/<fingerprint>',
          'Handshake file: ~/RoachNet/storage/state/runtime-cache/roachnet-runtime-handshake.json',
          'Launcher log: ~/RoachNet/storage/logs/roachnet-launcher-debug.log',
          'Server log: ~/RoachNet/storage/logs/roachnet-server.log',
          'Runtime process state: ~/RoachNet/storage/logs/roachnet-runtime-processes.json',
          'Health route after boot: /api/health',
          'Runtime API surface: same as the standard native app once the shell is live',
        ],
        implementation:
          'The Homebrew install now stages the compiled runtime inside the contained RoachNet storage root instead of /tmp. On macOS, native Node addons and dylibs in that cache are stripped of inherited xattrs and re-signed ad hoc before launch so clean Apple Silicon installs do not depend on host Homebrew dylibs or transient staging paths. If a first-boot Homebrew launch comes up dirty, the native bridge clears the contained runtime cache and process state once, retries, and only then records a bootstrap failure.',
        usedBy: ['RoachNet.app runtime boot after Homebrew install', 'roachnet.org/api Homebrew section'],
      },
    ],
  },
  {
    id: 'ios-distribution',
    label: 'RoachNetiOS Distribution',
    scope: 'packaging',
    basePath: '/iOS',
    summary: 'Unsigned IPA and SideStore source contract for the RoachNetiOS install lane.',
    stack: 'RoachNet-iOS release assets -> RoachNet-SideStore AltSource -> SideStore / AltStore signing flow -> RoachNetiOS first launch + RoachTail pairing',
    callers: ['roachnet.org/iOS', 'RoachNet-SideStore apps.json', 'SideStore URL scheme', 'RoachNetiOS first launch'],
    endpoints: [
      {
        id: 'ios-alt-source',
        method: 'GET',
        path: '/sidestore-source',
        title: 'SideStore source contract',
        summary: 'Documents the AltSource feed used to add RoachNetiOS to SideStore.',
        handler: 'RoachNet-SideStore/apps.json',
        request: ['No HTTP body. Static source metadata consumed by SideStore.'],
        response: [
          'Source URL: https://raw.githubusercontent.com/AHGRoach/RoachNet-SideStore/main/apps.json',
          'Source repo: https://github.com/AHGRoach/RoachNet-SideStore',
          'App: RoachNetiOS',
          'Bundle identifier: com.ahgrecords.RoachNetCompanion',
          'Use the raw source URL in SideStore when adding the feed manually.',
        ],
        implementation:
          'The SideStore source publishes the RoachNetiOS IPA metadata, icon, screenshots, supported iOS floor, and the privacy permission strings for QR pairing and local-network access. The website ships the raw source URL, the public source repo, and the IPA lane so the install path does not depend on undocumented SideStore deep links.',
        usedBy: ['roachnet.org/iOS install section', 'RoachNet SideStore repo', 'SideStore add-source flow'],
      },
      {
        id: 'ios-direct-ipa',
        method: 'GET',
        path: '/ipa',
        title: 'Direct IPA install contract',
        summary: 'Documents the direct IPA lane for SideStore or AltStore when the source is not used.',
        handler: 'RoachNet-iOS release asset',
        request: ['No HTTP body. Static packaging contract for sideload tooling.'],
        response: [
          'Release asset: https://github.com/AHGRoach/RoachNet-iOS/releases/latest/download/RoachNetiOS-v0.1.4-unsigned.ipa',
          'Download the IPA and share it to SideStore on-device.',
          'Version: 0.1.4',
          'Display name: RoachNetiOS',
        ],
        implementation:
          'The direct IPA lane keeps the current unsigned artifact available for manual SideStore or AltStore import. On-device, the user downloads the IPA and shares it into SideStore instead of relying on an undocumented install deep link. RoachNetiOS still lands in the same pairing and offline-capable RoachBrain flow after signing.',
        usedBy: ['roachnet.org/iOS install CTA', 'manual SideStore / AltStore import flow'],
      },
    ],
  },
  {
    id: 'account-web',
    label: 'Account + Web Chat',
    scope: 'website',
    basePath: '/.netlify/functions',
    summary: 'Supabase-backed website identity plus the free RoachClaw web chat path.',
    stack: 'accounts.roachnet.org auth surface -> Supabase Auth + RLS tables -> Netlify functions -> paired-device RoachClaw relay or RoachBrain Cloud fallback',
    callers: ['accounts.roachnet.org', 'roachnet.org/roachclaw'],
    endpoints: [
      {
        id: 'account-register',
        method: 'POST',
        path: '/register-account',
        title: 'Create one website account',
        summary: 'Creates a Supabase-backed RoachNet account for the website.',
        handler: 'netlify/functions/register-account.mjs',
        request: [
          'Body: { email, password, displayName?, startedAt?, company?, captchaToken? }',
          'Turnstile token when the challenge is armed on the deploy',
        ],
        response: ['JSON: { ok, message, userId? }', '409 when the email already exists'],
        implementation:
          'Runs server-side validation, optional Turnstile verification, then creates the user through the Supabase admin users API so sign-up can stay on the website without exposing the service-role key to the browser.',
        usedBy: ['accounts.roachnet.org create-account flow'],
      },
      {
        id: 'roachclaw-web-chat',
        method: 'POST',
        path: '/roachclaw-chat',
        title: 'Send one hosted RoachClaw prompt',
        summary: 'Verifies the signed-in account, checks thread ownership, stores the prompt, and answers through the paired device or hosted RoachBrain Cloud.',
        handler: 'netlify/functions/roachclaw-chat.mjs',
        request: [
          'Authorization: Bearer <Supabase access token>',
          'Body: { threadId?, message, bridgeUrl?, bridgeToken?, bridgeLabel? }',
        ],
        response: [
          'JSON: { ok, thread, userMessage, assistantMessage, provider, model }',
          '401 for missing or invalid account session',
          '404 for threads outside the caller account',
          '500 only when neither the paired-device path nor the hosted cloud path can finish the request',
        ],
        implementation:
          'The function verifies the bearer token against Supabase Auth, scopes every thread/message lookup to that user id, stores the prompt, and either forwards the request to the user’s paired RoachClaw device or answers through hosted RoachBrain Cloud. The browser-local RoachBrain path stays available as a last-resort client fallback, but the normal no-device route now stays account-scoped on the server.',
        usedBy: ['roachnet.org/roachclaw hosted chat workspace'],
      },
    ],
  },
  {
    id: 'roachclaw-local-context',
    label: 'RoachClaw Local Context',
    scope: 'native',
    basePath: 'local://roachnet',
    summary: 'Permissioned local context used by the native RoachClaw lane, floating panel, command bar, voice prompt path, and Dev inline assist.',
    stack: 'RoachNet native shell -> WorkspaceModel -> RoachBrainStore -> RoachBrainWikiStore -> RoachClaw prompt builder',
    callers: ['Native RoachClaw lane', 'Global RoachClaw panel', 'Command bar', 'Dev workspace inline assist', 'Voice prompt composer'],
    endpoints: [
      {
        id: 'local-roachbrain-wiki',
        method: 'LOCAL',
        path: 'vault/roachbrain/wiki',
        title: 'Compiled local RoachBrain wiki',
        summary: 'Exports saved RoachBrain memory into Obsidian-readable Markdown pages and a manifest inside the selected RoachNet storage root.',
        handler: 'RoachBrainWikiStore.rebuild',
        request: [
          'Input: saved RoachBrain memories',
          'Input: selected RoachNet storage root',
          'No cloud request is made by this export path',
        ],
        response: [
          'raw/memories.json',
          'pages/*.md',
          'index.md',
          'log.md',
          'AGENTS.md',
          'manifest.json',
        ],
        implementation:
          'Every RoachBrain save can rebuild a local Markdown wiki under the user-selected RoachNet storage root. RoachClaw then receives a bounded context block from direct memory plus the compiled wiki so normal chat, agent tasks, and research prompts can ground themselves without pretending to have invisible access.',
        usedBy: ['RoachClaw prompt context', 'Dev assistant prompt context', 'Obsidian-compatible vault reads'],
      },
      {
        id: 'global-roachclaw-command',
        method: 'LOCAL',
        path: 'command-bar/open-global-roachclaw',
        title: 'Open RoachClaw anywhere',
        summary: 'Summons the floating RoachClaw panel from any native surface or command-bar invocation.',
        handler: 'CommandBarTarget.openGlobalRoachClaw',
        request: [
          'Input: command palette selection or global shell button',
          'Optional: staged prompt text',
        ],
        response: [
          'Floating RoachClaw panel opens over the current surface',
          'Existing prompt draft and context permissions stay intact',
        ],
        implementation:
          'The command bar no longer has to switch the whole app into the full RoachClaw pane. It can open the floating panel over the current work surface, preserving the user’s active context and letting the same send, save, speak, and voice controls work everywhere.',
        usedBy: ['Global command bar', 'Top chrome RoachClaw action', 'Collapsed sidebar action'],
      },
      {
        id: 'voice-prompt-command',
        method: 'LOCAL',
        path: 'command-bar/start-voice-prompt',
        title: 'Start voice prompt',
        summary: 'Starts voice capture through the global RoachClaw panel and sends the transcript through the normal permissioned prompt path.',
        handler: 'CommandBarTarget.togglePromptDictation',
        request: [
          'Input: command palette selection or RoachClaw microphone control',
          'Requires microphone permission from macOS',
        ],
        response: [
          'Dictation toggles in the active RoachClaw composer',
          'Transcript remains editable before send',
        ],
        implementation:
          'Voice requests use the same prompt draft, context permission toggles, selected model, and RoachBrain context as typed requests. This keeps RoachClaw usable as a normal chat assistant while still letting the user escalate into task work when they ask for it.',
        usedBy: ['Full RoachClaw lane', 'Global RoachClaw panel', 'Command bar voice action'],
      },
      {
        id: 'dev-inline-agent-context',
        method: 'LOCAL',
        path: 'dev/inline-assist',
        title: 'Dev inline assist context',
        summary: 'Feeds open-file, shell, RoachBrain memory, compiled wiki, and app-state context into inline coding assistance.',
        handler: 'DevWorkspaceView.requestInlineSuggestion',
        request: [
          'Input: active file and selection',
          'Input: terminal transcript summary',
          'Input: permissioned app context and compiled RoachBrain wiki summary',
        ],
        response: [
          'Inline suggestion text',
          'Task-mode prompt when the user asks the assistant to inspect, act, verify, and record',
        ],
        implementation:
          'The Dev surface now treats RoachClaw as an IDE assistant instead of a preset-command sidebar. It keeps normal direct asks simple, and only enters the inspect-act-verify loop when the user asks for real task work.',
        usedBy: ['Dev workspace inline assistant', 'Dev assistant panel', 'RoachClaw-backed code suggestions'],
      },
    ],
  },
  {
    id: 'bootstrap',
    label: 'Bootstrap',
    scope: 'runtime',
    basePath: '',
    summary: 'Small bootstrap routes used by health checks and first-run setup.',
    stack: 'Adonis routes -> EasySetupController / inline handlers',
    callers: ['ManagedAppRuntime', 'Easy Setup flow', 'health probes'],
    endpoints: [
      {
        id: 'health',
        method: 'GET',
        path: '/api/health',
        title: 'Health check',
        summary: 'Minimal runtime readiness check.',
        handler: 'inline handler',
        request: ['No body required'],
        response: ['JSON: { status: "ok" }'],
        implementation: 'Used as the fast liveness route for the setup smoke test, native runtime boot checks, and container health probes.',
        usedBy: ['ManagedAppRuntime', 'scripts/run-roachnet.mjs', 'run-roachnet-setup.mjs', 'container health checks'],
      },
      {
        id: 'easy-setup-curated-categories',
        method: 'GET',
        path: '/api/easy-setup/curated-categories',
        title: 'Easy setup curated categories',
        summary: 'Returns the curated ZIM categories shown during easy setup.',
        handler: 'EasySetupController.listCuratedCategories',
        request: ['No body required'],
        response: ['Category and tier catalog from ZimService'],
        implementation: 'Bridges the setup UI to the curated ZIM catalog used for first-run content recommendations.',
        usedBy: ['Easy Setup content selection'],
      },
      {
        id: 'manifests-refresh',
        method: 'POST',
        path: '/api/manifests/refresh',
        title: 'Refresh manifests',
        summary: 'Refreshes cached ZIM, maps, and Wikipedia manifest specs.',
        handler: 'EasySetupController.refreshManifests',
        request: ['No body required'],
        response: ['JSON: { success, changed: { zim_categories, maps, wikipedia } }'],
        implementation: 'Fetches and caches the manifest specs that power content catalogs inside setup and the runtime.',
        usedBy: ['Easy Setup refresh action', 'content admin workflows'],
      },
    ],
  },
  {
    id: 'content-updates',
    label: 'Content Updates',
    scope: 'runtime',
    basePath: '/api/content-updates',
    summary: 'Checks and applies upstream collection updates.',
    stack: 'CollectionUpdatesController -> CollectionUpdateService',
    callers: ['Settings update surfaces', 'content maintenance flows'],
    endpoints: [
      {
        id: 'content-updates-check',
        method: 'POST',
        path: '/check',
        title: 'Check updates',
        summary: 'Scans mirrored collections for newer upstream versions.',
        handler: 'checkForUpdates',
        request: ['No body required'],
        response: ['Array of update candidates with download metadata'],
        implementation: 'Builds a content-update list by comparing mirrored manifest data with upstream versions.',
        usedBy: ['Content update checker'],
      },
      {
        id: 'content-updates-apply',
        method: 'POST',
        path: '/apply',
        title: 'Apply one update',
        summary: 'Applies a single collection update.',
        handler: 'applyUpdate',
        request: ['Body: validated update payload including download_url'],
        response: ['Service result for the applied update'],
        implementation: 'Validates the update payload, blocks private URLs, then runs the single-update flow through CollectionUpdateService.',
        usedBy: ['Per-item apply action'],
      },
      {
        id: 'content-updates-apply-all',
        method: 'POST',
        path: '/apply-all',
        title: 'Apply all updates',
        summary: 'Applies a batch of collection updates.',
        handler: 'applyAllUpdates',
        request: ['Body: { updates: [...] }'],
        response: ['Batch result from CollectionUpdateService'],
        implementation: 'Validates every update, blocks private URLs, then processes the whole queue through the batch updater.',
        usedBy: ['Apply all content updates'],
      },
    ],
  },
  {
    id: 'companion',
    label: 'Companion',
    scope: 'runtime',
    basePath: '/api/companion',
    summary: 'Desktop companion token plus per-device RoachTail peer tokens for iPhone and iPad, with RoachSync state and future account-linked device metadata folded into the same bridge.',
    stack: 'roachnet-companion-server.mjs -> peer-aware token gate -> CompanionController -> ChatService / OllamaService / runtime relays -> RoachTail/RoachSync state in contained storage',
    callers: ['RoachNet iOS companion', 'future iPad surfaces'],
    endpoints: [
      {
        id: 'companion-bootstrap',
        method: 'GET',
        path: '/bootstrap',
        title: 'Companion bootstrap',
        summary: 'Returns the first mobile payload: runtime, vault, catalog URL, and recent sessions.',
        handler: 'CompanionController.bootstrap',
        request: [
          'Primary companion token or paired RoachTail peer token at the sidecar layer',
          'No body required',
        ],
        response: ['appName, machineName (friendly desktop label), appsCatalogUrl, runtime, vault, sessions'],
        implementation:
          'The public sidecar listens on the companion port, verifies either the long-lived desktop token or a hashed per-peer RoachTail token, and proxies into the desktop runtime. The controller then fans out to runtimePayload, vaultPayload, and ChatService.getAllSessions() so the phone app can paint in one round-trip.',
        usedBy: ['RoachNet iOS first launch', 'manual refresh after saving connection settings'],
      },
      {
        id: 'companion-runtime',
        method: 'GET',
        path: '/runtime',
        title: 'Runtime snapshot',
        summary: 'Returns desktop runtime, RoachClaw, service, and download state for the phone.',
        handler: 'CompanionController.runtime',
        request: ['Token-gated request, no body required'],
        response: ['systemInfo, providers, roachClaw, roachTail, roachSync, services, downloads, installedModels, issues'],
        implementation:
          'CompanionController.runtimePayload relays into the existing system, AI-provider, RoachClaw, downloads, installed-model, RoachTail, and RoachSync state surfaces, then coalesces failures into an issues array so the mobile UI can stay live even when one service is still warming up. Paired peer tokens only get this full payload while RoachTail is armed.',
        usedBy: ['Runtime tab', 'RoachTail status panel', 'RoachSync status panel', 'post-service-action refreshes', 'bootstrap payload'],
      },
      {
        id: 'companion-roachtail',
        method: 'GET',
        path: '/roachtail',
        title: 'RoachTail status',
        summary: 'Returns the private-device overlay state used by the companion app.',
        handler: 'CompanionController.roachtail',
        request: ['Token-gated request, no body required'],
        response: ['enabled, networkName, deviceName, deviceId, status, relayHost, advertisedUrl, runtimeOrigin?, runtimeTunnelUrl?, joinCode?, joinCodeIssuedAt?, joinCodeExpiresAt?, pairingPayload?, pairingIssuedAt?, notes, peers'],
        implementation:
          'Reads a RoachTail state snapshot from contained RoachNet storage when one exists, then falls back to the current companion env/config so the iPhone and iPad surfaces can still show bridge readiness before a full mesh config has been written. Peer-token requests still get this route while RoachTail is off so the phone can re-arm the bridge, but the one-time join code is redacted from paired peers. Desktop callers also receive the QR-friendly pairing payload that wraps bridge URL, join code, and transport hints.',
        usedBy: ['Runtime tab status cards', 'RoachTail toggle state', 'desktop QR pairing panel', 'Connection debugging'],
      },
      {
        id: 'companion-roachtail-pair',
        method: 'POST',
        path: '/roachtail/pair',
        title: 'Pair one device with RoachTail',
        summary: 'Validates a one-time join code, creates or updates the peer record, and mints a per-device bridge token.',
        handler: 'CompanionController.pairRoachTail',
        request: [
          'Body: { joinCode, peerId?, peerName?, platform?, endpoint?, appVersion?, allowsExitNode?, tags? }',
          'The sidecar leaves this route open specifically so a new device can pair before it has a token.',
        ],
        response: ['success, message, token, peerId, bridgeUrl, state'],
        implementation:
          'The controller checks that RoachTail is enabled, validates the one-time join code against the contained state record and its short expiry window, mints a private peer token, stores only its SHA-256 hash, and returns the plaintext token once so the phone can save it into its secure local settings. RoachNetiOS now keeps that token in the iOS Keychain instead of plain user defaults.',
        usedBy: ['RoachNet iOS connection sheet', 'first-time phone pairing flow'],
      },
      {
        id: 'companion-roachtail-affect',
        method: 'POST',
        path: '/roachtail/affect',
        title: 'Mutate RoachTail state',
        summary: 'Turns the overlay on or off, refreshes join codes, and clears or edits peers.',
        handler: 'CompanionController.affectRoachTail',
        request: [
          'Body: { action, relayHost?, peerId?, peerName?, platform?, endpoint?, allowsExitNode?, tags? }',
          'Supported actions: enable, disable, refresh-join-code, clear-peers, set-relay-host, register-peer, remove-peer',
        ],
        response: ['success, message, state'],
        implementation:
          'Writes RoachTail state back into contained storage instead of keeping it in transient process memory, so the desktop shell, setup app, and mobile runtime all read the same source of truth. Peer tokens can toggle enable/disable and self-link or self-unlink, while refresh-code, relay-host, and full-peer edits stay restricted to the desktop companion token.',
        usedBy: ['RoachNet iOS runtime toggle', 'RoachNet macOS runtime panel', 'future relay-host editing'],
      },
      {
        id: 'companion-roachsync',
        method: 'GET',
        path: '/roachsync',
        title: 'RoachSync status',
        summary: 'Returns the contained sync snapshot the desktop and phone use for shared vault state.',
        handler: 'CompanionController.roachsync',
        request: ['Token-gated request, no body required'],
        response: ['enabled, provider, networkName, deviceName, deviceId, status, folderId, folderPath, guiUrl?, apiUrl?, notes, peers'],
        implementation:
          'Reads the RoachSync state record from contained storage and falls back to the local vault path plus Syncthing-flavored defaults when sync has not been armed yet. This keeps the iPhone and desktop runtime panes aligned around the same sync root.',
        usedBy: ['RoachNet iOS runtime tab', 'RoachNet macOS runtime panel'],
      },
      {
        id: 'companion-roachsync-affect',
        method: 'POST',
        path: '/roachsync/affect',
        title: 'Mutate RoachSync state',
        summary: 'Turns contained sync on or off, refreshes its state, and clears peer metadata.',
        handler: 'CompanionController.affectRoachSync',
        request: [
          'Body: { action, folderPath? }',
          'Supported actions: enable, disable, refresh, set-folder-path, clear-peers',
        ],
        response: ['success, message, state'],
        implementation:
          'Writes the RoachSync state record back into contained storage so the desktop shell, the phone runtime view, and future account-backed sync surfaces all reflect the same vault-sync source of truth.',
        usedBy: ['RoachNet iOS runtime toggle', 'RoachNet macOS runtime panel'],
      },
      {
        id: 'companion-vault',
        method: 'GET',
        path: '/vault',
        title: 'Vault snapshot',
        summary: 'Returns RoachBrain memory summaries, knowledge files, and site archive stubs.',
        handler: 'CompanionController.vault',
        request: ['Token-gated request, no body required'],
        response: ['knowledgeFiles, siteArchives, roachBrain, issues'],
        implementation:
          'Builds a mobile-safe vault summary instead of exposing raw local filesystem roots. The controller trims the payload down to note summaries, file labels, archive metadata, and issue records.',
        usedBy: ['Vault tab', 'bootstrap payload'],
      },
      {
        id: 'companion-sessions-index',
        method: 'GET',
        path: '/chat/sessions',
        title: 'List chat sessions',
        summary: 'Returns the chat session index visible to the companion app.',
        handler: 'CompanionController.sessionsIndex',
        request: ['Token-gated request, no body required'],
        response: ['Array of chat session summaries'],
        implementation:
          'Passes through ChatService.getAllSessions() so the phone can render session history and reopen the current desktop chat.',
        usedBy: ['Chat history sheet', 'bootstrap payload'],
      },
      {
        id: 'companion-sessions-show',
        method: 'GET',
        path: '/chat/sessions/:id',
        title: 'Load one session',
        summary: 'Returns the full message list for a specific session.',
        handler: 'CompanionController.sessionsShow',
        request: ['Path param: id'],
        response: ['Full chat session with message history', '404 if the session is missing'],
        implementation:
          'Coerces the session id to a number and resolves the chat session through ChatService. Missing or synthetic local-only ids resolve to a 404.',
        usedBy: ['Opening a prior chat from the mobile history sheet'],
      },
      {
        id: 'companion-sessions-store',
        method: 'POST',
        path: '/chat/sessions',
        title: 'Create mobile session',
        summary: 'Creates a new chat session, with a synthetic fallback when the desktop chat DB is unavailable.',
        handler: 'CompanionController.sessionsStore',
        request: ['Body: { title?, model? }'],
        response: ['201 with a persisted chat session or a synthetic local session summary'],
        implementation:
          'The controller first tries ChatService.createSession(). If that fails, it still returns a local companion-safe session summary so the phone UI can keep moving instead of hard failing at boot.',
        usedBy: ['New Chat action in RoachNet iOS'],
      },
      {
        id: 'companion-chat-send',
        method: 'POST',
        path: '/chat/send',
        title: 'Send one message',
        summary: 'Sends a mobile prompt through RoachClaw and returns both user and assistant messages.',
        handler: 'CompanionController.sendMessage',
        request: ['Body: { sessionId?, content, model?, messages? }'],
        response: ['session, userMessage, assistantMessage', '500 with a readable AI/runtime error when Ollama is unreachable'],
        implementation:
          'If a persisted session exists, the message flows through ChatService and OllamaService. If the desktop chat DB is unavailable, the controller falls back to a stateless ephemeral send path that uses the provided mobile history and still talks to the real AI runtime.',
        usedBy: ['Chat composer in RoachNet iOS', 'RoachBrain carryover after pairing'],
      },
      {
        id: 'companion-install',
        method: 'POST',
        path: '/install',
        title: 'Forward one install intent',
        summary: 'Accepts the same install-intent payloads used by apps.roachnet.org and forwards them into the desktop runtime.',
        handler: 'CompanionController.install',
        request: ['Body: install intent payload from the Apps catalog, including action/slug/category/model/url metadata'],
        response: ['JSON: { ok, action, result }'],
        implementation:
          'Normalizes the incoming intent, maps it onto the existing runtime install actions, and dispatches it into the same content/model install flows the website already uses. The iOS app keeps a local pending-install queue when this bridge is unavailable, then flushes the queue back through this route on reconnect. The mobile app also accepts roachnet://install-content deep links, so the website, Apps store, and phone app all share the same install-intent contract.',
        usedBy: ['Apps tab install buttons in RoachNet iOS', 'roachnet://install-content handoff into RoachNetiOS', 'Reconnect flush for queued mobile installs'],
      },
      {
        id: 'companion-services-affect',
        method: 'POST',
        path: '/services/affect',
        title: 'Affect one service',
        summary: 'Starts, stops, or restarts a named desktop service from the phone.',
        handler: 'CompanionController.affectService',
        request: ['Body: { serviceName, action } where action is start | stop | restart'],
        response: ['JSON: { ok, serviceName, action, result }', '400 for missing service name or invalid action'],
        implementation:
          'Relays directly into /api/system/services/affect after input validation, so the mobile surface does not need a separate service-control implementation.',
        usedBy: ['Runtime tab service controls in RoachNet iOS'],
      },
    ],
  },
  {
    id: 'maps',
    label: 'Maps',
    scope: 'runtime',
    basePath: '/api/maps',
    summary: 'Map catalog, style generation, and download orchestration.',
    stack: 'MapsController -> MapService',
    callers: ['Maps surface', 'ManagedAppRuntime', 'Apps install handoff'],
    endpoints: [
      {
        id: 'maps-regions',
        method: 'GET',
        path: '/regions',
        title: 'List installed regions',
        summary: 'Returns installed map region files.',
        handler: 'listRegions',
        request: ['No body required'],
        response: ['Installed region file listing'],
        implementation: 'Reads the local map storage state from MapService.',
        usedBy: ['Maps browser', 'native runtime snapshot'],
      },
      {
        id: 'maps-styles',
        method: 'GET',
        path: '/styles',
        title: 'Generate styles JSON',
        summary: 'Returns the live style bundle used by the map renderer.',
        handler: 'styles',
        request: ['Host and protocol are derived from the incoming request'],
        response: ['MapLibre style JSON'],
        implementation: 'Ensures base assets exist first, then generates style JSON with the current host and protocol wired in.',
        usedBy: ['Map renderer bootstrap'],
      },
      {
        id: 'maps-curated-collections',
        method: 'GET',
        path: '/curated-collections',
        title: 'Curated collections',
        summary: 'Returns the install-ready map collections catalog.',
        handler: 'listCuratedCollections',
        request: ['No body required'],
        response: ['Curated collections manifest'],
        implementation: 'Reads the curated map collection spec exposed to the native app and the Apps handoff flow.',
        usedBy: ['Apps install flow', 'ManagedAppRuntime'],
      },
      {
        id: 'maps-fetch-latest-collections',
        method: 'POST',
        path: '/fetch-latest-collections',
        title: 'Refresh map collections',
        summary: 'Refreshes the remote map collections manifest.',
        handler: 'fetchLatestCollections',
        request: ['No body required'],
        response: ['JSON: { success }'],
        implementation: 'Fetches the newest collection spec and updates the cached manifest used by Maps.',
        usedBy: ['Maps admin refresh'],
      },
      {
        id: 'maps-download-base-assets',
        method: 'POST',
        path: '/download-base-assets',
        title: 'Download base assets',
        summary: 'Downloads the shared basemap assets used by all region packs.',
        handler: 'downloadBaseAssets',
        request: ['Body: optional { url } override'],
        response: ['JSON: { success: true }'],
        implementation: 'Optionally accepts a mirror URL, blocks private URLs, then downloads the shared atlas assets through MapService.',
        usedBy: ['Base atlas install', 'Maps first-run prep'],
      },
      {
        id: 'maps-download-remote',
        method: 'POST',
        path: '/download-remote',
        title: 'Download one remote map file',
        summary: 'Queues a direct remote map-file download.',
        handler: 'downloadRemote',
        request: ['Body: { url }'],
        response: ['JSON: { message, filename, url }'],
        implementation: 'Validates the remote URL, blocks private targets, and starts a background region download.',
        usedBy: ['Manual map import'],
      },
      {
        id: 'maps-download-remote-preflight',
        method: 'POST',
        path: '/download-remote-preflight',
        title: 'Map download preflight',
        summary: 'Returns metadata before a map download starts.',
        handler: 'downloadRemotePreflight',
        request: ['Body: { url }'],
        response: ['Remote file metadata / preflight info'],
        implementation: 'Runs a safe metadata pass before the background download begins so the UI can warn or confirm.',
        usedBy: ['Manual import confirmation UI'],
      },
      {
        id: 'maps-download-collection',
        method: 'POST',
        path: '/download-collection',
        title: 'Download collection',
        summary: 'Queues every resource in a named map collection.',
        handler: 'downloadCollection',
        request: ['Body: { slug }'],
        response: ['JSON: { message, slug, resources }'],
        implementation: 'Looks up the named curated collection and dispatches every resource in that bundle.',
        usedBy: ['Apps install handoff', 'ManagedAppRuntime.downloadMapCollection'],
      },
      {
        id: 'maps-delete',
        method: 'DELETE',
        path: '/:filename',
        title: 'Delete map file',
        summary: 'Deletes one installed map asset.',
        handler: 'delete',
        request: ['Path param: filename'],
        response: ['JSON: { message }', '404 if the file key is missing'],
        implementation: 'Validates the filename param, removes the file from map storage, and translates missing files to a 404.',
        usedBy: ['Map cleanup actions'],
      },
    ],
  },
  {
    id: 'docs',
    label: 'Docs',
    scope: 'runtime',
    basePath: '/api/docs',
    summary: 'Internal document listing used by the docs surface.',
    stack: 'DocsController -> DocsService',
    callers: ['Docs browser'],
    endpoints: [
      {
        id: 'docs-list',
        method: 'GET',
        path: '/list',
        title: 'List docs',
        summary: 'Returns available RoachNet docs entries.',
        handler: 'DocsController.list',
        request: ['No body required'],
        response: ['Docs list'],
        implementation: 'Reads the docs inventory used by the internal docs browser.',
        usedBy: ['Docs index'],
      },
    ],
  },
  {
    id: 'downloads',
    label: 'Downloads',
    scope: 'runtime',
    basePath: '/api/downloads',
    summary: 'Background download job inspection and cleanup.',
    stack: 'DownloadsController -> DownloadService',
    callers: ['ManagedAppRuntime', 'download status widgets'],
    endpoints: [
      {
        id: 'downloads-jobs',
        method: 'GET',
        path: '/jobs',
        title: 'List download jobs',
        summary: 'Returns all tracked download jobs.',
        handler: 'index',
        request: ['No body required'],
        response: ['Full download job list'],
        implementation:
          'Reads current download job state from DownloadService and the shared queue registry so contained-mode model pulls and App Store content installs stay visible across requests.',
        usedBy: ['ManagedAppRuntime', 'download dashboard'],
      },
      {
        id: 'downloads-jobs-filetype',
        method: 'GET',
        path: '/jobs/:filetype',
        title: 'List download jobs by filetype',
        summary: 'Returns jobs filtered to one filetype.',
        handler: 'filetype',
        request: ['Path param: filetype'],
        response: ['Filtered download job list'],
        implementation: 'Validates the filetype param and filters the job view inside DownloadService.',
        usedBy: ['Scoped download panes'],
      },
      {
        id: 'downloads-remove-job',
        method: 'DELETE',
        path: '/jobs/:jobId',
        title: 'Remove failed job',
        summary: 'Removes a failed or stale download job from the queue state.',
        handler: 'removeJob',
        request: ['Path param: jobId'],
        response: ['JSON: { success: true }'],
        implementation: 'Clears failed-job state without touching completed local files.',
        usedBy: ['Download error recovery'],
      },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    scope: 'runtime',
    basePath: '/api/ollama',
    summary: 'Contained model catalog, local/cloud chat, and model lifecycle operations.',
    stack: 'OllamaController -> OllamaService / RagService / ChatService',
    callers: ['RoachClaw', 'AI chat', 'model store', 'ManagedAppRuntime'],
    endpoints: [
      {
        id: 'ollama-chat',
        method: 'POST',
        path: '/chat',
        title: 'Chat',
        summary: 'Runs chat requests, optional SSE streaming, and RAG context injection.',
        handler: 'chat',
        request: [
          'Body: validated chat payload from chatSchema',
          'Core keys include model, messages, stream, think, and optional sessionId',
        ],
        response: [
          'JSON chat result for non-streaming requests',
          'SSE stream with status, chunk, done, and error events when stream=true',
        ],
        implementation:
          'Injects default system prompts, rewrites search queries for RAG when needed, optionally pulls relevant documents, saves chat history, and streams or returns the final model response through OllamaService.',
        usedBy: ['RoachClaw chat pane', 'native AI chat surface'],
      },
      {
        id: 'ollama-models-list',
        method: 'GET',
        path: '/models',
        title: 'Available models',
        summary: 'Returns the model catalog filtered for search, sort, and recommendations.',
        handler: 'availableModels',
        request: ['Query: sort, recommendedOnly, query, limit, force'],
        response: ['Available model catalog'],
        implementation: 'Validates the request, then asks OllamaService for the curated or searched model list.',
        usedBy: ['Model store', 'AI settings'],
      },
      {
        id: 'ollama-models-download',
        method: 'POST',
        path: '/models',
        title: 'Queue model download',
        summary: 'Dispatches a model download job.',
        handler: 'dispatchModelDownload',
        request: ['Body: { model }'],
        response: ['JSON: { success, message }'],
        implementation:
          'Validates the model name and dispatches the download through OllamaService. In contained queue-disabled mode the inline worker retries until the local Ollama runtime is ready, so first-boot model pulls stay alive on clean installs.',
        usedBy: ['Model store install actions', 'first-launch RoachClaw bootstrap'],
      },
      {
        id: 'ollama-models-delete',
        method: 'DELETE',
        path: '/models',
        title: 'Delete model',
        summary: 'Deletes one installed model.',
        handler: 'deleteModel',
        request: ['Body: { model }'],
        response: ['JSON: { success, message }'],
        implementation: 'Validates the model name, then removes it through OllamaService.',
        usedBy: ['Model cleanup actions'],
      },
      {
        id: 'ollama-installed-models',
        method: 'GET',
        path: '/installed-models',
        title: 'Installed models',
        summary: 'Returns installed local models with a safe empty fallback.',
        handler: 'installedModels',
        request: ['No body required'],
        response: ['Installed model array'],
        implementation: 'Reads the installed-model list from the active Ollama runtime and falls back to an empty array if the runtime is unavailable or still warming up.',
        usedBy: ['ManagedAppRuntime', 'RoachClaw status', 'model picker', 'model store'],
      },
    ],
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    scope: 'runtime',
    basePath: '/api/openclaw',
    summary: 'Skill discovery and install endpoints for OpenClaw.',
    stack: 'OpenClawController -> OpenClawService',
    callers: ['RoachClaw setup', 'skills browser'],
    endpoints: [
      {
        id: 'openclaw-skills-status',
        method: 'GET',
        path: '/skills/status',
        title: 'Skill CLI status',
        summary: 'Returns status for the OpenClaw skill CLI.',
        handler: 'getSkillCliStatus',
        request: ['No body required'],
        response: ['CLI status object'],
        implementation: 'Checks the underlying OpenClaw skill CLI so the native shell can show install readiness.',
        usedBy: ['RoachClaw status UI'],
      },
      {
        id: 'openclaw-skills-search',
        method: 'GET',
        path: '/skills/search',
        title: 'Search skills',
        summary: 'Searches ClawHub skills by query.',
        handler: 'searchSkills',
        request: ['Query: query, limit'],
        response: ['Search result list'],
        implementation: 'Normalizes the query, bounds the limit, then sends the search through OpenClawService.',
        usedBy: ['Skill search UI'],
      },
      {
        id: 'openclaw-skills-installed',
        method: 'GET',
        path: '/skills/installed',
        title: 'Installed skills',
        summary: 'Returns installed OpenClaw skills.',
        handler: 'listInstalledSkills',
        request: ['No body required'],
        response: ['Installed skills array'],
        implementation: 'Reads installed skills from OpenClawService.',
        usedBy: ['ManagedAppRuntime', 'skills status cards'],
      },
      {
        id: 'openclaw-skills-install',
        method: 'POST',
        path: '/skills/install',
        title: 'Install skill',
        summary: 'Installs one ClawHub skill.',
        handler: 'installSkill',
        request: ['Body: { slug, version? }'],
        response: ['Install result or 422 / 400 error'],
        implementation: 'Requires a skill slug, then delegates the install to OpenClawService with an optional version pin.',
        usedBy: ['Skill install action'],
      },
    ],
  },
  {
    id: 'roachclaw',
    label: 'RoachClaw',
    scope: 'runtime',
    basePath: '/api/roachclaw',
    summary: 'RoachClaw status, onboarding application, and portable profile export.',
    stack: 'RoachClawController -> RoachClawService -> contained workspace profile writer',
    callers: ['RoachClaw pane', 'ManagedAppRuntime'],
    endpoints: [
      {
        id: 'roachclaw-status',
        method: 'GET',
        path: '/status',
        title: 'RoachClaw status',
        summary: 'Returns the current RoachClaw runtime state.',
        handler: 'getStatus',
        request: ['No body required'],
        response: ['RoachClaw status object'],
        implementation: 'Returns the resolved contained/local/cloud RoachClaw status, configured model, and service reachability from RoachClawService.',
        usedBy: ['RoachClaw status card', 'ManagedAppRuntime', 'setup post-install checks'],
      },
      {
        id: 'roachclaw-profile',
        method: 'GET',
        path: '/profile',
        title: 'Portable RoachClaw profile',
        summary: 'Returns the contained RoachClaw portable profile used by the desktop runtime and future web surfaces.',
        handler: 'getProfile',
        request: ['No body required'],
        response: ['Portable RoachClaw profile object with portableRoot, workspacePath, stateDir, defaultModel, provider URLs, and launch hints'],
        implementation:
          'Asks RoachClawService for the current portable profile, which captures the contained workspace root plus the default model and provider URLs in one machine-local contract the desktop runtime and future RoachClaw web chat surface can both read.',
        usedBy: ['ManagedAppRuntime', 'future RoachClaw web chat surface', 'portable profile inspection'],
      },
      {
        id: 'roachclaw-apply',
        method: 'POST',
        path: '/apply',
        title: 'Apply onboarding',
        summary: 'Writes model and endpoint choices into RoachClaw.',
        handler: 'apply',
        request: ['Body: { model, workspacePath, ollamaBaseUrl, openclawBaseUrl }'],
        response: ['Onboarding apply result or 400 error'],
        implementation: 'Accepts the onboarding payload directly, then asks RoachClawService to persist and apply it.',
        usedBy: ['RoachClaw first-run flow'],
      },
    ],
  },
  {
    id: 'site-archives',
    label: 'Site Archives',
    scope: 'runtime',
    basePath: '/api/site-archives',
    summary: 'Creates and deletes local static site archives.',
    stack: 'SiteArchivesController -> SiteArchiveService',
    callers: ['Site archive screen'],
    endpoints: [
      {
        id: 'site-archives-list',
        method: 'GET',
        path: '/',
        title: 'List archives',
        summary: 'Returns every local site archive.',
        handler: 'list',
        request: ['No body required'],
        response: ['JSON: { archives }'],
        implementation: 'Reads archive metadata from SiteArchiveService.',
        usedBy: ['Site archive index'],
      },
      {
        id: 'site-archives-create',
        method: 'POST',
        path: '/',
        title: 'Create archive',
        summary: 'Creates a new website archive.',
        handler: 'create',
        request: ['Body: { url, title }'],
        response: ['Archive creation result or 400 error'],
        implementation: 'Passes the user-supplied URL and title into SiteArchiveService, which captures and stores the archive bundle.',
        usedBy: ['Archive capture form'],
      },
      {
        id: 'site-archives-destroy',
        method: 'DELETE',
        path: '/:slug',
        title: 'Delete archive',
        summary: 'Deletes one stored archive.',
        handler: 'destroy',
        request: ['Path param: slug'],
        response: ['JSON: { success: true }'],
        implementation: 'Deletes the named archive bundle and its metadata.',
        usedBy: ['Archive delete action'],
      },
    ],
  },
  {
    id: 'chat',
    label: 'Chat Sessions',
    scope: 'runtime',
    basePath: '/api/chat',
    summary: 'Session CRUD and suggestion endpoints for the native chat surface.',
    stack: 'ChatsController -> ChatService / AIRuntimeService',
    callers: ['Native chat UI', 'RoachClaw chat surface'],
    endpoints: [
      {
        id: 'chat-sessions-index',
        method: 'GET',
        path: '/sessions/',
        title: 'List sessions',
        summary: 'Returns all saved chat sessions.',
        handler: 'index',
        request: ['No body required'],
        response: ['Session array'],
        implementation: 'Reads every session from ChatService.',
        usedBy: ['Chat sidebar'],
      },
      {
        id: 'chat-sessions-create',
        method: 'POST',
        path: '/sessions/',
        title: 'Create session',
        summary: 'Creates a new chat session.',
        handler: 'store',
        request: ['Body: { title, model }'],
        response: ['201 with created session'],
        implementation: 'Validates the payload and creates a new session row through ChatService.',
        usedBy: ['New chat action'],
      },
      {
        id: 'chat-sessions-destroy-all',
        method: 'DELETE',
        path: '/sessions/all',
        title: 'Delete all sessions',
        summary: 'Clears every stored chat session.',
        handler: 'destroyAll',
        request: ['No body required'],
        response: ['JSON result from deleteAllSessions'],
        implementation: 'Runs the bulk-delete path in ChatService.',
        usedBy: ['Danger-zone cleanup action'],
      },
      {
        id: 'chat-sessions-show',
        method: 'GET',
        path: '/sessions/:id',
        title: 'Show session',
        summary: 'Returns one chat session.',
        handler: 'show',
        request: ['Path param: id'],
        response: ['Session object or 404'],
        implementation: 'Parses the numeric session id and returns the full thread from ChatService.',
        usedBy: ['Chat thread loader'],
      },
      {
        id: 'chat-sessions-update',
        method: 'PUT',
        path: '/sessions/:id',
        title: 'Update session',
        summary: 'Updates one chat session.',
        handler: 'update',
        request: ['Path param: id', 'Body: validated updateSessionSchema payload'],
        response: ['Updated session object'],
        implementation: 'Validates the incoming update and applies it through ChatService.',
        usedBy: ['Rename / model change actions'],
      },
      {
        id: 'chat-sessions-delete',
        method: 'DELETE',
        path: '/sessions/:id',
        title: 'Delete session',
        summary: 'Deletes one chat session.',
        handler: 'destroy',
        request: ['Path param: id'],
        response: ['204 on success'],
        implementation: 'Deletes one session row and its messages through ChatService.',
        usedBy: ['Per-thread delete action'],
      },
      {
        id: 'chat-sessions-add-message',
        method: 'POST',
        path: '/sessions/:id/messages',
        title: 'Add message',
        summary: 'Adds a message to a saved chat session.',
        handler: 'addMessage',
        request: ['Path param: id', 'Body: { role, content }'],
        response: ['201 with created message'],
        implementation: 'Validates the message payload and appends it to the session in ChatService.',
        usedBy: ['Message persistence flows'],
      },
      {
        id: 'chat-suggestions',
        method: 'GET',
        path: '/suggestions',
        title: 'Chat suggestions',
        summary: 'Returns starter prompts with a fallback set.',
        handler: 'suggestions',
        request: ['No body required'],
        response: ['JSON: { suggestions }'],
        implementation: 'Fetches live chat suggestions and falls back to a built-in set if generation fails or returns nothing.',
        usedBy: ['Chat empty state'],
      },
    ],
  },
  {
    id: 'rag',
    label: 'RAG',
    scope: 'runtime',
    basePath: '/api/rag',
    summary: 'File upload, embedding jobs, and vector-store sync.',
    stack: 'RagController -> RagService / EmbedFileJob',
    callers: ['Knowledge/RAG workflows', 'AI chat context'],
    endpoints: [
      {
        id: 'rag-upload',
        method: 'POST',
        path: '/upload',
        title: 'Upload file',
        summary: 'Uploads a file and queues embedding.',
        handler: 'upload',
        request: ['Multipart form-data with file field'],
        response: ['202 with { message, jobId, fileName, filePath, alreadyProcessing }'],
        implementation: 'Stores the uploaded file in RAG storage, generates a unique name, and dispatches the embedding background job.',
        usedBy: ['Knowledge file upload'],
      },
      {
        id: 'rag-files',
        method: 'GET',
        path: '/files',
        title: 'Stored files',
        summary: 'Returns stored RAG files.',
        handler: 'getStoredFiles',
        request: ['No body required'],
        response: ['JSON: { files }'],
        implementation: 'Reads the stored-file list from RagService.',
        usedBy: ['Knowledge file inventory'],
      },
      {
        id: 'rag-files-delete',
        method: 'DELETE',
        path: '/files',
        title: 'Delete stored file',
        summary: 'Deletes a stored RAG file by source.',
        handler: 'deleteFile',
        request: ['Body / validated payload: { source }'],
        response: ['JSON: { message } or 500 error'],
        implementation: 'Deletes the file and its vectorized representation by source identifier.',
        usedBy: ['Knowledge cleanup'],
      },
      {
        id: 'rag-active-jobs',
        method: 'GET',
        path: '/active-jobs',
        title: 'Active jobs',
        summary: 'Returns active embedding jobs.',
        handler: 'getActiveJobs',
        request: ['No body required'],
        response: ['Active job array'],
        implementation: 'Lists active EmbedFileJob entries.',
        usedBy: ['Knowledge job status widgets'],
      },
      {
        id: 'rag-job-status',
        method: 'GET',
        path: '/job-status',
        title: 'Job status',
        summary: 'Returns embedding status for one uploaded file.',
        handler: 'getJobStatus',
        request: ['Query / validated payload: filePath'],
        response: ['Status object or 404'],
        implementation: 'Maps the file path back into upload storage and asks EmbedFileJob for the current status.',
        usedBy: ['Post-upload progress polling'],
      },
      {
        id: 'rag-sync',
        method: 'POST',
        path: '/sync',
        title: 'Scan and sync',
        summary: 'Scans storage and syncs vector references.',
        handler: 'scanAndSync',
        request: ['No body required'],
        response: ['Sync result or 500 error'],
        implementation: 'Runs the storage scan and vector-store reconciliation path in RagService.',
        usedBy: ['Knowledge maintenance'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    scope: 'runtime',
    basePath: '/api/system',
    summary: 'Status, services, updates, sync, and key-value settings.',
    stack:
      'SystemController -> SystemService / DockerService / AIRuntimeService / SystemUpdateService / UpstreamSyncService / NativeRuntimeSnapshotService / ContainerRegistryService',
    callers: ['ManagedAppRuntime', 'Settings pages', 'service controls', 'update flows'],
    endpoints: [
      {
        id: 'system-debug-info',
        method: 'GET',
        path: '/debug-info',
        title: 'Debug info',
        summary: 'Returns debug information gathered from SystemService.',
        handler: 'getDebugInfo',
        request: ['No body required'],
        response: ['JSON: { debugInfo }'],
        implementation: 'Wraps the lower-level debug snapshot in a single response object for the native debug sheet.',
        usedBy: ['Debug info modal'],
      },
      {
        id: 'system-info',
        method: 'GET',
        path: '/info',
        title: 'System info',
        summary: 'Returns host and environment information.',
        handler: 'getSystemInfo',
        request: ['No body required'],
        response: ['System info object'],
        implementation: 'Passes through SystemService host/environment details.',
        usedBy: ['ManagedAppRuntime snapshot', 'system settings'],
      },
      {
        id: 'system-internet-status',
        method: 'GET',
        path: '/internet-status',
        title: 'Internet status',
        summary: 'Returns current connectivity state.',
        handler: 'getInternetStatus',
        request: ['No body required'],
        response: ['Connectivity status object'],
        implementation: 'Delegates to SystemService for internet reachability checks.',
        usedBy: ['ManagedAppRuntime', 'status cards'],
      },
      {
        id: 'system-services',
        method: 'GET',
        path: '/services',
        title: 'Services',
        summary: 'Returns managed service status across the runtime.',
        handler: 'getServices',
        request: ['No body required'],
        response: ['Service list including installed and available services'],
        implementation: 'Queries SystemService for the full managed service list with installedOnly=false.',
        usedBy: ['ManagedAppRuntime', 'system settings services page'],
      },
      {
        id: 'system-ai-providers',
        method: 'GET',
        path: '/ai/providers',
        title: 'AI providers',
        summary: 'Returns detected AI runtime providers.',
        handler: 'getAIRuntimeProviders',
        request: ['No body required'],
        response: ['Provider array'],
        implementation: 'Reads provider availability from AIRuntimeService.',
        usedBy: ['AI settings', 'ManagedAppRuntime'],
      },
      {
        id: 'system-native-snapshot',
        method: 'GET',
        path: '/native-snapshot',
        title: 'Native snapshot',
        summary: 'Returns a compact native-shell snapshot for the macOS client.',
        handler: 'getNativeSnapshot',
        request: ['No body required'],
        response: ['Native runtime snapshot'],
        implementation: 'Packages the small native-facing snapshot from NativeRuntimeSnapshotService.',
        usedBy: ['Native shell overview'],
      },
      {
        id: 'system-services-affect',
        method: 'POST',
        path: '/services/affect',
        title: 'Affect service',
        summary: 'Starts, stops, restarts, or otherwise affects a managed service.',
        handler: 'affectService',
        request: ['Body: validated { service_name, action }'],
        response: ['JSON: { success, message }'],
        implementation: 'Validates the requested action and sends it into DockerService.affectContainer.',
        usedBy: ['Service action buttons'],
      },
      {
        id: 'system-services-install',
        method: 'POST',
        path: '/services/install',
        title: 'Install service',
        summary: 'Runs a preflight install for one managed service.',
        handler: 'installService',
        request: ['Body: validated { service_name }'],
        response: ['JSON: { success, message }'],
        implementation: 'Runs the container preflight installer path in DockerService and returns the result.',
        usedBy: ['Install service controls'],
      },
      {
        id: 'system-services-force-reinstall',
        method: 'POST',
        path: '/services/force-reinstall',
        title: 'Force reinstall service',
        summary: 'Forces a service reinstall.',
        handler: 'forceReinstallService',
        request: ['Body: validated { service_name }'],
        response: ['JSON: { success, message }'],
        implementation: 'Calls DockerService.forceReinstall after validation.',
        usedBy: ['Repair / reset service actions'],
      },
      {
        id: 'system-services-check-updates',
        method: 'POST',
        path: '/services/check-updates',
        title: 'Check service updates',
        summary: 'Dispatches the background service-update check.',
        handler: 'checkServiceUpdates',
        request: ['No body required'],
        response: ['JSON: { success: true, message }'],
        implementation: 'Dispatches CheckServiceUpdatesJob and returns immediately.',
        usedBy: ['Service updates page'],
      },
      {
        id: 'system-services-available-versions',
        method: 'GET',
        path: '/services/:name/available-versions',
        title: 'Available service versions',
        summary: 'Returns installable versions for one service.',
        handler: 'getAvailableVersions',
        request: ['Path param: name'],
        response: ['JSON: { versions } or 404 / 500 error'],
        implementation: 'Looks up the installed service record, detects host architecture, then asks ContainerRegistryService for matching tags.',
        usedBy: ['Version picker in updates UI'],
      },
      {
        id: 'system-services-update',
        method: 'POST',
        path: '/services/update',
        title: 'Update service',
        summary: 'Moves a service to a target version.',
        handler: 'updateService',
        request: ['Body: validated { service_name, target_version }'],
        response: ['JSON: { success, message } or 400 error'],
        implementation: 'Calls DockerService.updateContainer with the requested target version.',
        usedBy: ['Pinned service update action'],
      },
      {
        id: 'system-subscribe-release-notes',
        method: 'POST',
        path: '/subscribe-release-notes',
        title: 'Subscribe to release notes',
        summary: 'Subscribes an email to release notes.',
        handler: 'subscribeToReleaseNotes',
        request: ['Body: validated { email }'],
        response: ['Subscription result'],
        implementation: 'Validates the email and forwards it to SystemService.',
        usedBy: ['Support / update forms'],
      },
      {
        id: 'system-latest-version',
        method: 'GET',
        path: '/latest-version',
        title: 'Latest version',
        summary: 'Checks the latest available RoachNet version.',
        handler: 'checkLatestVersion',
        request: ['Query: force'],
        response: ['Version status payload'],
        implementation: 'Validates the force flag and asks SystemService for the latest-version check result.',
        usedBy: ['Update page'],
      },
      {
        id: 'system-update',
        method: 'POST',
        path: '/update',
        title: 'Request system update',
        summary: 'Starts a system update if the updater sidecar is present.',
        handler: 'requestSystemUpdate',
        request: ['No body required'],
        response: ['JSON success/error with note about status polling'],
        implementation: 'Guards on sidecar availability, then asks SystemUpdateService to request the update.',
        usedBy: ['Update button'],
      },
      {
        id: 'system-update-status',
        method: 'GET',
        path: '/update/status',
        title: 'Update status',
        summary: 'Returns current system update status.',
        handler: 'getSystemUpdateStatus',
        request: ['No body required'],
        response: ['Update status object or 500 error'],
        implementation: 'Returns the in-memory/system update status snapshot.',
        usedBy: ['Update progress UI'],
      },
      {
        id: 'system-update-logs',
        method: 'GET',
        path: '/update/logs',
        title: 'Update logs',
        summary: 'Returns current system update logs.',
        handler: 'getSystemUpdateLogs',
        request: ['No body required'],
        response: ['JSON: { logs }'],
        implementation: 'Passes through update logs from SystemUpdateService.',
        usedBy: ['Update troubleshooting UI'],
      },
      {
        id: 'system-upstream-sync-status',
        method: 'GET',
        path: '/upstream-sync/status',
        title: 'Upstream sync status',
        summary: 'Returns upstream mirror sync status.',
        handler: 'getUpstreamSyncStatus',
        request: ['Query: force'],
        response: ['Upstream sync status payload'],
        implementation: 'Supports a force refresh flag and returns the sync state from UpstreamSyncService.',
        usedBy: ['Mirror/sync status UI'],
      },
      {
        id: 'system-upstream-sync',
        method: 'POST',
        path: '/upstream-sync',
        title: 'Request upstream sync',
        summary: 'Starts the upstream sync run.',
        handler: 'requestUpstreamSync',
        request: ['No body required'],
        response: ['Sync result or 409 error'],
        implementation: 'Asks UpstreamSyncService to start a sync and exposes the conflict state if one is already active.',
        usedBy: ['Mirror sync action'],
      },
      {
        id: 'system-upstream-sync-logs',
        method: 'GET',
        path: '/upstream-sync/logs',
        title: 'Upstream sync logs',
        summary: 'Returns sync logs from the current or last run.',
        handler: 'getUpstreamSyncLogs',
        request: ['No body required'],
        response: ['JSON: { logs }'],
        implementation: 'Returns logs captured by UpstreamSyncService.',
        usedBy: ['Mirror sync diagnostics'],
      },
      {
        id: 'system-settings-get',
        method: 'GET',
        path: '/settings',
        title: 'Get setting',
        summary: 'Returns one persisted key-value setting.',
        handler: 'getSetting',
        request: ['Query: key'],
        response: ['JSON: { key, value }'],
        implementation: 'Reads the requested key from KVStore.',
        usedBy: ['Settings page loaders'],
      },
      {
        id: 'system-settings-update',
        method: 'PATCH',
        path: '/settings',
        title: 'Update setting',
        summary: 'Updates one persisted key-value setting.',
        handler: 'updateSetting',
        request: ['Body: validated { key, value }'],
        response: ['JSON: { success: true, message }'],
        implementation: 'Validates the key/value payload and persists it through SystemService.',
        usedBy: ['Settings toggles and forms'],
      },
    ],
  },
  {
    id: 'zim',
    label: 'ZIM',
    scope: 'runtime',
    basePath: '/api/zim',
    summary: 'ZIM library inventory, remote catalogs, curated tiers, and Wikipedia selection.',
    stack: 'ZimController -> ZimService',
    callers: ['Education surfaces', 'Apps install handoff', 'ManagedAppRuntime'],
    endpoints: [
      {
        id: 'zim-list',
        method: 'GET',
        path: '/list',
        title: 'List local ZIM files',
        summary: 'Returns local ZIM inventory.',
        handler: 'list',
        request: ['No body required'],
        response: ['Local ZIM inventory'],
        implementation: 'Reads the current local ZIM state from ZimService.',
        usedBy: ['ZIM settings page'],
      },
      {
        id: 'zim-list-remote',
        method: 'GET',
        path: '/list-remote',
        title: 'List remote ZIM files',
        summary: 'Searches the remote ZIM catalog.',
        handler: 'listRemote',
        request: ['Query: start, count, query'],
        response: ['Remote ZIM search results'],
        implementation: 'Validates pagination/search params, then asks ZimService for the remote catalog window.',
        usedBy: ['Remote explorer'],
      },
      {
        id: 'zim-curated-categories',
        method: 'GET',
        path: '/curated-categories',
        title: 'Curated categories',
        summary: 'Returns the curated ZIM category/tier catalog.',
        handler: 'listCuratedCategories',
        request: ['No body required'],
        response: ['Curated category tree'],
        implementation: 'Returns the curated education/reference catalog used by setup, apps, and managed runtime surfaces.',
        usedBy: ['ManagedAppRuntime', 'Apps install flow', 'Easy Setup'],
      },
      {
        id: 'zim-download-remote',
        method: 'POST',
        path: '/download-remote',
        title: 'Download remote ZIM',
        summary: 'Queues a remote ZIM download.',
        handler: 'downloadRemote',
        request: ['Body: validated { url, metadata? }'],
        response: ['JSON: { message, filename, jobId, url }'],
        implementation: 'Validates the remote URL, blocks private targets, and dispatches the remote ZIM download through ZimService.',
        usedBy: ['Remote explorer install'],
      },
      {
        id: 'zim-download-category-tier',
        method: 'POST',
        path: '/download-category-tier',
        title: 'Download category tier',
        summary: 'Queues every resource in one curated category tier.',
        handler: 'downloadCategoryTier',
        request: ['Body: { categorySlug, tierSlug }'],
        response: ['JSON: { message, categorySlug, tierSlug, resources }'],
        implementation: 'Looks up the category tier and dispatches every resource inside that tier.',
        usedBy: ['Apps install handoff', 'ManagedAppRuntime.downloadCategoryTier'],
      },
      {
        id: 'zim-wikipedia',
        method: 'GET',
        path: '/wikipedia',
        title: 'Wikipedia state',
        summary: 'Returns the current selected Wikipedia pack state.',
        handler: 'getWikipediaState',
        request: ['No body required'],
        response: ['Wikipedia selection state'],
        implementation: 'Reads the current Wikipedia option state from ZimService.',
        usedBy: ['ManagedAppRuntime', 'Wikipedia selector'],
      },
      {
        id: 'zim-wikipedia-select',
        method: 'POST',
        path: '/wikipedia/select',
        title: 'Select Wikipedia pack',
        summary: 'Sets the active Wikipedia option.',
        handler: 'selectWikipedia',
        request: ['Body: { optionId }'],
        response: ['Selection result'],
        implementation: 'Validates the option id, then switches the active Wikipedia pack in ZimService.',
        usedBy: ['Wikipedia selector UI'],
      },
      {
        id: 'zim-delete',
        method: 'DELETE',
        path: '/:filename',
        title: 'Delete ZIM file',
        summary: 'Deletes one installed ZIM file.',
        handler: 'delete',
        request: ['Path param: filename'],
        response: ['JSON: { message } or 404'],
        implementation: 'Validates the filename and removes it from local ZIM storage.',
        usedBy: ['ZIM cleanup action'],
      },
    ],
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    scope: 'runtime',
    basePath: '/api/benchmark',
    summary: 'Benchmark execution, results, submission, and settings.',
    stack: 'BenchmarkController -> BenchmarkService / RunBenchmarkJob',
    callers: ['Benchmark page'],
    endpoints: [
      {
        id: 'benchmark-run',
        method: 'POST',
        path: '/run',
        title: 'Run benchmark',
        summary: 'Starts a full, system, or AI benchmark run.',
        handler: 'run',
        request: ['Body: validated benchmark payload', 'Optional sync=true for synchronous dev execution'],
        response: ['201 queued result or direct synchronous benchmark result', '409 if one is already running'],
        implementation: 'Validates the requested benchmark type, guards against concurrent runs, and either executes immediately or dispatches RunBenchmarkJob.',
        usedBy: ['Primary benchmark action'],
      },
      {
        id: 'benchmark-run-system',
        method: 'POST',
        path: '/run/system',
        title: 'Run system benchmark',
        summary: 'Starts a system-only benchmark.',
        handler: 'runSystem',
        request: ['No body required'],
        response: ['201 with benchmark_id or 409 on active run'],
        implementation: 'Queues a system-only RunBenchmarkJob.',
        usedBy: ['System benchmark quick action'],
      },
      {
        id: 'benchmark-run-ai',
        method: 'POST',
        path: '/run/ai',
        title: 'Run AI benchmark',
        summary: 'Starts an AI-only benchmark.',
        handler: 'runAI',
        request: ['No body required'],
        response: ['201 with benchmark_id or 409 on active run'],
        implementation: 'Queues an AI-only RunBenchmarkJob.',
        usedBy: ['AI benchmark quick action'],
      },
      {
        id: 'benchmark-results',
        method: 'GET',
        path: '/results',
        title: 'All results',
        summary: 'Returns every benchmark result.',
        handler: 'results',
        request: ['No body required'],
        response: ['JSON: { results, total }'],
        implementation: 'Returns the full benchmark history from BenchmarkService.',
        usedBy: ['Benchmark results view'],
      },
      {
        id: 'benchmark-results-latest',
        method: 'GET',
        path: '/results/latest',
        title: 'Latest result',
        summary: 'Returns the latest benchmark result.',
        handler: 'latest',
        request: ['No body required'],
        response: ['JSON: { result }'],
        implementation: 'Reads the newest benchmark result or null if nothing has run yet.',
        usedBy: ['Latest result card'],
      },
      {
        id: 'benchmark-results-show',
        method: 'GET',
        path: '/results/:id',
        title: 'Result by id',
        summary: 'Returns one benchmark result.',
        handler: 'show',
        request: ['Path param: id'],
        response: ['JSON: { result } or 404'],
        implementation: 'Loads one stored result by id and returns 404 when it is missing.',
        usedBy: ['Benchmark detail view'],
      },
      {
        id: 'benchmark-submit',
        method: 'POST',
        path: '/submit',
        title: 'Submit result',
        summary: 'Submits a result to the central benchmark repository.',
        handler: 'submit',
        request: ['Body: validated submit payload', 'Optional anonymous=true'],
        response: ['JSON: { success, repository_id, percentile } or error'],
        implementation: 'Validates the submission, then forwards it to BenchmarkService with optional anonymous mode.',
        usedBy: ['Submit benchmark action'],
      },
      {
        id: 'benchmark-builder-tag',
        method: 'POST',
        path: '/builder-tag',
        title: 'Update builder tag',
        summary: 'Assigns or clears a builder tag on a result.',
        handler: 'updateBuilderTag',
        request: ['Body: { benchmark_id, builder_tag }'],
        response: ['JSON: { success, builder_tag } or validation errors'],
        implementation: 'Loads the result, validates the tag format, then persists the builder tag.',
        usedBy: ['Benchmark metadata editor'],
      },
      {
        id: 'benchmark-comparison',
        method: 'GET',
        path: '/comparison',
        title: 'Comparison stats',
        summary: 'Returns comparison stats from the central repository.',
        handler: 'comparison',
        request: ['No body required'],
        response: ['JSON: { stats }'],
        implementation: 'Returns comparison aggregates from BenchmarkService.',
        usedBy: ['Benchmark comparison view'],
      },
      {
        id: 'benchmark-status',
        method: 'GET',
        path: '/status',
        title: 'Benchmark status',
        summary: 'Returns the current run status.',
        handler: 'status',
        request: ['No body required'],
        response: ['Current benchmark status'],
        implementation: 'Returns the live status snapshot from BenchmarkService.',
        usedBy: ['Benchmark progress state'],
      },
      {
        id: 'benchmark-settings',
        method: 'GET',
        path: '/settings',
        title: 'Benchmark settings',
        summary: 'Returns persisted benchmark settings.',
        handler: 'settings',
        request: ['No body required'],
        response: ['Benchmark settings object'],
        implementation: 'Reads all benchmark settings from the BenchmarkSetting model.',
        usedBy: ['Benchmark settings page'],
      },
      {
        id: 'benchmark-settings-update',
        method: 'POST',
        path: '/settings',
        title: 'Update benchmark settings',
        summary: 'Updates persisted benchmark settings.',
        handler: 'updateSettings',
        request: ['Body: currently supports allow_anonymous_submission'],
        response: ['JSON: { success, settings }'],
        implementation: 'Updates persisted benchmark settings and returns the refreshed settings payload.',
        usedBy: ['Benchmark settings form'],
      },
    ],
  },
]

const methodOrder = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const groupNav = document.querySelector('#api-group-nav')
const statsMount = document.querySelector('#api-stats')
const groupSummary = document.querySelector('#api-group-summary')
const routeList = document.querySelector('#api-route-list')
const detailPane = document.querySelector('#api-detail-pane')
const searchInput = document.querySelector('#api-search')
const methodFilter = document.querySelector('#api-method-filter')
const routeCount = document.querySelector('#api-route-count')
const viewTitle = document.querySelector('#api-view-title')

const flattenedRoutes = apiGroups.flatMap((group) =>
  group.endpoints.map((endpoint) => ({
    ...endpoint,
    scope: group.scope,
    groupId: group.id,
    groupLabel: group.label,
    groupSummary: group.summary,
    groupStack: group.stack,
    groupCallers: group.callers,
    fullPath: `${group.basePath}${endpoint.path}`.replace(/\/{2,}/g, '/'),
  }))
)

let activeGroup = 'all'
let activeMethod = 'ALL'
let activeRouteId = flattenedRoutes[0]?.id || null
let searchQuery = ''

function renderStats() {
  const setupCount = flattenedRoutes.filter((route) => route.scope === 'setup').length
  const runtimeCount = flattenedRoutes.filter((route) => route.scope === 'runtime').length

  statsMount.innerHTML = `
    <article class="api-docs-stat">
      <strong>${flattenedRoutes.length}</strong>
      <span>Total routes</span>
    </article>
    <article class="api-docs-stat">
      <strong>${runtimeCount}</strong>
      <span>Runtime</span>
    </article>
    <article class="api-docs-stat">
      <strong>${setupCount}</strong>
      <span>Setup</span>
    </article>
  `
}

function renderGroupNav() {
  const items = [
    {
      id: 'all',
      label: 'All routes',
      count: flattenedRoutes.length,
      summary: 'Every documented setup and runtime route.',
    },
    ...apiGroups.map((group) => ({
      id: group.id,
      label: group.label,
      count: group.endpoints.length,
      summary: group.summary,
    })),
  ]

  groupNav.innerHTML = items
    .map(
      (item) => `
        <button class="api-docs-group${item.id === activeGroup ? ' is-active' : ''}" data-group-id="${item.id}" type="button">
          <span class="api-docs-group__copy">
            <strong>${item.label}</strong>
            <small>${item.summary}</small>
          </span>
          <span class="api-docs-group__count">${item.count}</span>
        </button>
      `
    )
    .join('')

  groupNav.querySelectorAll('[data-group-id]').forEach((button) => {
    button.addEventListener('click', () => {
      activeGroup = button.getAttribute('data-group-id') || 'all'
      syncSelection()
      renderAll()
    })
  })
}

function renderMethodFilter() {
  const counts = methodOrder.reduce((acc, method) => {
    acc[method] =
      method === 'ALL'
        ? flattenedRoutes.length
        : flattenedRoutes.filter((route) => route.method === method).length
    return acc
  }, {})

  methodFilter.innerHTML = methodOrder
    .map(
      (method) => `
        <button class="api-method-chip${method === activeMethod ? ' is-active' : ''}" data-method="${method}" type="button">
          ${method}
          <span>${counts[method]}</span>
        </button>
      `
    )
    .join('')

  methodFilter.querySelectorAll('[data-method]').forEach((button) => {
    button.addEventListener('click', () => {
      activeMethod = button.getAttribute('data-method') || 'ALL'
      syncSelection()
      renderAll()
    })
  })
}

function getCurrentGroup() {
  if (activeGroup === 'all') {
    return null
  }
  return apiGroups.find((group) => group.id === activeGroup) || null
}

function getFilteredRoutes() {
  return flattenedRoutes.filter((route) => {
    const matchesGroup = activeGroup === 'all' || route.groupId === activeGroup
    const matchesMethod = activeMethod === 'ALL' || route.method === activeMethod
    const haystack = [
      route.groupLabel,
      route.title,
      route.summary,
      route.fullPath,
      route.handler,
      route.groupStack,
      ...(route.usedBy || []),
      ...(route.request || []),
      ...(route.response || []),
      route.implementation,
    ]
      .join(' ')
      .toLowerCase()
    const matchesSearch = !searchQuery || haystack.includes(searchQuery)
    return matchesGroup && matchesMethod && matchesSearch
  })
}

function syncSelection() {
  const filtered = getFilteredRoutes()
  if (!filtered.find((route) => route.id === activeRouteId)) {
    activeRouteId = filtered[0]?.id || null
  }
}

function renderSummary() {
  const currentGroup = getCurrentGroup()
  const filtered = getFilteredRoutes()
  const title = currentGroup ? currentGroup.label : searchQuery ? 'Search results' : 'All endpoints'
  const summary = currentGroup
    ? currentGroup.summary
    : searchQuery
      ? `Filtered by “${searchQuery}”.`
      : 'Setup routes, runtime routes, and the service edges behind them.'

  viewTitle.textContent = title
  routeCount.textContent = `${filtered.length} routes`

  groupSummary.innerHTML = `
    <div class="api-docs-hero__copy">
      <span class="api-docs-kicker">${currentGroup ? currentGroup.scope : 'runtime + setup'}</span>
      <h2>${title}</h2>
      <p>${summary}</p>
    </div>
    <div class="api-docs-hero__meta">
      <article>
        <span>Visible</span>
        <strong>${filtered.length}</strong>
      </article>
      <article>
        <span>Group</span>
        <strong>${currentGroup ? currentGroup.endpoints.length : flattenedRoutes.length}</strong>
      </article>
      <article>
        <span>Stack</span>
        <strong>${currentGroup ? currentGroup.stack.split(' -> ').length : apiGroups.length} layers</strong>
      </article>
    </div>
  `
}

function renderRouteList() {
  const filtered = getFilteredRoutes()

  if (!filtered.length) {
    routeList.innerHTML = `
      <div class="api-empty-state">
        <span class="api-docs-kicker">No matches</span>
        <h3>Nothing lines up with that filter.</h3>
        <p>Try a different group, method, or search term.</p>
      </div>
    `
    return
  }

  routeList.innerHTML = filtered
    .map(
      (route) => `
        <button class="api-route-card${route.id === activeRouteId ? ' is-active' : ''}" data-route-id="${route.id}" type="button">
          <div class="api-route-card__top">
            <span class="api-route-card__method api-route-card__method--${route.method.toLowerCase()}">${route.method}</span>
            <span class="api-route-card__group">${route.groupLabel}</span>
          </div>
          <strong>${route.title}</strong>
          <code>${route.fullPath}</code>
          <p>${route.summary}</p>
          <span class="api-route-card__handler">${route.handler}</span>
        </button>
      `
    )
    .join('')

  routeList.querySelectorAll('[data-route-id]').forEach((button) => {
    button.addEventListener('click', () => {
      activeRouteId = button.getAttribute('data-route-id')
      renderRouteList()
      renderDetail()
      updateHash()
      button.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
      snapDetailPaneIntoView('smooth')
    })
  })
}

function renderDetail() {
  const route = flattenedRoutes.find((item) => item.id === activeRouteId)

  if (!route) {
    detailPane.innerHTML = `
      <div class="api-empty-state api-empty-state--detail">
        <span class="api-docs-kicker">Select a route</span>
        <h3>Pick an endpoint.</h3>
        <p>Click any route on the left and the request, response, and implementation contract snap in here.</p>
      </div>
    `
    return
  }

  detailPane.innerHTML = `
    <div class="api-detail-header">
      <div class="api-detail-header__badges">
        <span class="api-route-card__method api-route-card__method--${route.method.toLowerCase()}">${route.method}</span>
        <span class="api-detail-header__group">${route.groupLabel}</span>
      </div>
      <h3>${route.title}</h3>
      <code>${route.fullPath}</code>
      <p>${route.summary}</p>
    </div>

    <section class="api-detail-block">
      <span class="api-docs-kicker">Handler</span>
      <strong>${route.handler}</strong>
      <p>${route.groupStack}</p>
    </section>

    <section class="api-detail-block">
      <span class="api-docs-kicker">Request</span>
      <ul>${(route.request || []).map((item) => `<li>${item}</li>`).join('')}</ul>
    </section>

    <section class="api-detail-block">
      <span class="api-docs-kicker">Response</span>
      <ul>${(route.response || []).map((item) => `<li>${item}</li>`).join('')}</ul>
    </section>

    <section class="api-detail-block">
      <span class="api-docs-kicker">Implementation</span>
      <p>${route.implementation}</p>
    </section>

    <section class="api-detail-block">
      <span class="api-docs-kicker">Called from</span>
      <ul>${(route.usedBy || route.groupCallers || []).map((item) => `<li>${item}</li>`).join('')}</ul>
    </section>
  `

  detailPane.scrollTop = 0
}

function updateHash() {
  if (!activeRouteId) {
    return
  }
  history.replaceState(null, '', `#${activeRouteId}`)
}

function snapDetailPaneIntoView(behavior = 'smooth') {
  if (!detailPane) {
    return
  }

  window.requestAnimationFrame(() => {
    detailPane.scrollIntoView({
      behavior,
      block: 'start',
    })
  })
}

function hydrateFromHash() {
  const id = window.location.hash.replace(/^#/, '').trim()
  if (!id) {
    return
  }
  const route = flattenedRoutes.find((item) => item.id === id)
  if (!route) {
    return
  }
  activeGroup = route.groupId
  activeRouteId = route.id
}

function renderAll() {
  renderStats()
  renderGroupNav()
  renderMethodFilter()
  renderSummary()
  renderRouteList()
  renderDetail()
}

searchInput?.addEventListener('input', (event) => {
  searchQuery = String(event.currentTarget.value || '').trim().toLowerCase()
  syncSelection()
  renderAll()
})

hydrateFromHash()
syncSelection()
renderAll()
if (window.location.hash) {
  snapDetailPaneIntoView('auto')
}

window.addEventListener('hashchange', () => {
  hydrateFromHash()
  syncSelection()
  renderAll()
  snapDetailPaneIntoView('smooth')
})
