// RoachNet API reference (roachnet.org/api/).
// The route data below is reconciled against the RoachNet 1.1.0 Mac release
// (tag v1.1.0): native/macos/Sources/RoachNetRuntime/Router.swift, Org/OrgRouter.swift
// and friends. 1.1 adds feature packs, RoachClaw Org, live collections and the
// companion theme, the model server's Ollama, OpenAI and Anthropic APIs,
// RoachNet Cluster, RoachTrace, plan models and bring-your-own agents, and the
// loopback API asks for a token when RoachNet.app started the runtime.
// `source` on each route points at the line that answers it.
// Text fields support `code` spans written with backticks; everything else is
// escaped before it reaches innerHTML.

const surfaces = {
  setup: {
    label: 'Setup service',
    base: '$SETUP',
    where: '127.0.0.1, ephemeral port (set `ROACHNET_SETUP_PORT` to pin it)',
    auth: 'No token. Loopback Host header only; JSON bodies must be sent as `application/json`.',
  },
  runtime: {
    label: 'Loopback API',
    base: '$ROACHNET',
    where: '127.0.0.1, ephemeral port (read `baseUrl` from the runtime state file)',
    auth: 'When RoachNet.app started the runtime: `authorization: Bearer <token>` (or `x-roachnet-api-token`) with the launch token from `native-server-info.json`, or a RoachClaw API token (`rn_…`) whose scope covers the route. `GET /api/health` needs none. Loopback Host only; JSON bodies must be sent as `application/json`, or you get a 415.',
  },
  companion: {
    label: 'Companion bridge',
    base: '$BRIDGE',
    where: '127.0.0.1:38111 by default, or your RoachTail relay host',
    auth: '`authorization: Bearer <companion token>` or a paired device’s `rtp_` token. The same routes also answer on the loopback API without one.',
  },
  models: {
    label: 'Model server',
    base: '$MODELS',
    where: '127.0.0.1:36434 (`OLLAMA_BASE_URL` moves it)',
    auth: 'No token, like Ollama. Loopback Host only, and an Origin header must be a loopback, `app://`, `file://`, `tauri://` or `vscode-webview://` origin. Bodies may be sent without a JSON content type, as Ollama clients do.',
  },
  web: {
    label: 'roachnet.org',
    base: 'https://roachnet.org',
    where: 'Netlify functions on roachnet.org',
    auth: 'Origin must be roachnet.org or accounts.roachnet.org. Chat needs a Supabase session token.',
  },
}

const apiGroups = [
  {
    id: 'setup',
    label: 'Setup service',
    scope: 'setup',
    summary: 'The installer backend RoachNet Setup.app talks to before anything is installed.',
    stack: 'RoachNet Setup.app → roachnet-runtime --setup → SetupEngine.handle',
    callers: ['RoachNet Setup.app (RoachNetSetup/main.swift)'],
    endpoints: [
      {
        id: 'setup-state',
        method: 'GET',
        path: '/api/state',
        title: 'Installer state',
        summary: 'Machine checks, saved choices and the current or last install task, in one read.',
        handler: 'SetupEngine.state',
        source: 'SetupEngine.swift:886',
        request: [
          'Query, all optional: `installPath`, `installedAppPath`, `storagePath`, `installProfile`, `roachClawDefaultModel`, `releaseChannel`, `updateBaseUrl` and the companion settings.',
          'Boolean flags count as true only when the value is the string `true`: `installRoachClaw`, `companionEnabled`, `autoLaunch`, `autoCheckUpdates`, `launchAtLogin`, `dryRun`.',
        ],
        response: [
          '`system`: chip, macOS version, memory, recommended starter model, `runtime: "native-swift"`.',
          '`config`: saved choices merged with any query overrides.',
          '`dependencies`: preflight checks for Apple Silicon, macOS 14 or later, free space, a writable install folder and memory.',
          '`nativeApp`, `installLooksReady`, `activeTask`, `lastCompletedTask`, `sourceModes`.',
          '`containerRuntime` is always unavailable. RoachNet does not use containers.',
        ],
        implementation:
          'Query overrides are previewed, not saved. The install needs 2 GiB free, or 5 GiB with RoachClaw. The reply carries the saved config, companion token included, which is one reason the service only answers a loopback Host.',
        usedBy: ['Setup overview and preflight cards', 'Install-path and storage choosers'],
      },
      {
        id: 'setup-config',
        method: 'POST',
        path: '/api/config',
        title: 'Save installer choices',
        summary: 'Normalizes and saves setup choices without installing anything.',
        handler: 'SetupEngine.defaultConfig + saveConfig',
        source: 'SetupEngine.swift:888',
        body: { installPath: '~/RoachNet', installRoachClaw: true, autoLaunch: true },
        request: [
          'JSON body: any subset of the installer config, for example `installPath`, `storagePath`, `installRoachClaw`, `roachClawDefaultModel`, `autoLaunch`, `releaseChannel` (`stable`, `beta` or `alpha`).',
        ],
        response: ['`{ ok: true, config }` with every default filled in.'],
        implementation:
          'Saved to `~/Library/Application Support/roachnet/roachnet-installer.json`. Two fields are pinned whatever you send: `sourceMode` is always `bundled` and `useDockerContainerization` is always false.',
        usedBy: ['Install-path chooser', 'Storage-path chooser', 'RoachClaw toggle'],
      },
      {
        id: 'setup-install',
        method: 'POST',
        path: '/api/install',
        title: 'Start the install',
        summary: 'Starts the staged install and returns at once. Poll /api/state for progress.',
        handler: 'SetupEngine.startInstall → runInstall',
        source: 'SetupEngine.swift:892 (workflow at :467)',
        body: { installPath: '~/RoachNet', installRoachClaw: true, dryRun: true },
        request: [
          'JSON body: the installer config, same fields as /api/config.',
          '`dryRun: true` returns a finished preview task and changes nothing.',
        ],
        response: [
          '`{ ok: true }` once the task starts.',
          '`{ ok: true, task }` in dry-run mode.',
          '409 if an install is already running.',
        ],
        implementation:
          'Phases, with the progress each starts at: inspect (5), validate (12), stage beside the target (24), RoachClaw (38: nothing to install, RoachInference is inside the helper; upgrades drop an old `runtime/vendor/ollama`), manifest (52), copy RoachNet.app (64), boot the staged runtime until /api/health answers (76), swap the root and carry `storage/` across (88), point the `RoachNet` hostname at loopback (94), launch (98). A failure removes the staging folder and leaves the previous install alone.',
        usedBy: ['Install button in RoachNet Setup.app', 'roachnet-runtime --install runs the same workflow without HTTP'],
      },
      {
        id: 'setup-launch',
        method: 'POST',
        path: '/api/launch',
        title: 'Open RoachNet',
        summary: 'Opens the installed native app.',
        handler: 'SetupEngine.launch',
        source: 'SetupEngine.swift:894 (launch at :877)',
        body: { installPath: '~/RoachNet' },
        request: ['JSON body: `installPath`, optional `installedAppPath`.'],
        response: [
          '`{ ok: true, launched: "native-app", installedAppPath }`.',
          '400 if the app is not at that path yet.',
        ],
        implementation:
          'Records `lastOpenedMode: "app"` and `preferredShell: "native"`. There is no fallback launcher anymore, so a missing app means a 400.',
        usedBy: ['Finish step in RoachNet Setup.app'],
      },
      {
        id: 'setup-container-runtime-start',
        method: 'POST',
        path: '/api/container-runtime/start',
        title: 'Container runtime (retired)',
        summary: 'Still routed so a client that asks gets a clear no. Always a 400.',
        handler: 'SetupEngine.handle',
        source: 'SetupEngine.swift:896',
        request: ['No body needed.'],
        response: ['400 `{ ok: false, error: "RoachNet runs natively and does not use a container runtime." }`'],
        implementation:
          'Docker support left with the Node runtime. The route stays so older setup flows get an answer instead of a 404.',
        usedBy: ['RoachNet Setup.app keeps the call for compatibility'],
      },
      {
        id: 'setup-health',
        method: 'GET',
        path: '/api/health',
        title: 'Setup health',
        summary: 'Liveness for the setup service. `/health` answers too.',
        handler: 'SetupEngine.handle',
        source: 'SetupEngine.swift:898',
        request: ['None.'],
        response: ['`{ status: "ok", runtime: "native-swift", mode: "setup" }`'],
        implementation: 'Same answer on `/health` and `/api/health`.',
        usedBy: ['RoachNet Setup.app while it waits for its backend'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    scope: 'runtime',
    summary: 'Health, hardware, services and updates for the Mac you are on.',
    stack: 'RoachNet.app → roachnet-runtime (loopback) → NativeRuntime.route',
    callers: ['RoachNet.app (RoachNetCore/ManagedAppRuntime.swift)'],
    endpoints: [
      {
        id: 'health',
        method: 'GET',
        path: '/api/health',
        title: 'Runtime health',
        summary: 'Liveness check. The cheapest call the runtime answers.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:132',
        request: ['None.'],
        response: ['`{ status: "ok" }`'],
        implementation:
          'The runtime writes this URL as `healthUrl` in its server-info file. Setup polls it to verify a fresh install; the app polls it before trusting the runtime.',
        usedBy: ['RoachNet.app runtime supervisor', 'Setup verification phase'],
      },
      {
        id: 'system-internet-status',
        method: 'GET',
        path: '/api/system/internet-status',
        title: 'Internet check',
        summary: 'A bare boolean: whether github.com resolves.',
        handler: 'DNS.resolves',
        source: 'Router.swift:143',
        request: ['None.'],
        response: ['`true` or `false`, not wrapped in an object.'],
        implementation: 'A DNS lookup with a three-second timeout. No request is sent to GitHub.',
      },
      {
        id: 'system-info',
        method: 'GET',
        path: '/api/system/info',
        title: 'Hardware profile',
        summary: 'CPU, memory, OS and the model size this Mac can carry.',
        handler: 'NativeRuntime.systemInfo',
        source: 'Router.swift:144 (RoachClawStatus.swift:111)',
        request: ['None.'],
        response: [
          '`cpu`: brand and core counts.',
          '`mem`: total and available bytes.',
          '`os`: hostname, arch, kernel.',
          '`hardwareProfile`: `memoryTier` (`compact` under 16 GB, `balanced`, `creator` from 32 GB) and `recommendedModelClass` (`1.5b`, `7b`, `14b`).',
        ],
        implementation: 'Read from the OS on every call. Nothing is cached or sent anywhere.',
      },
      {
        id: 'system-services',
        method: 'GET',
        path: '/api/system/services',
        title: 'Service list',
        summary: 'The six services the command grid shows, with install state.',
        handler: 'NativeRuntime.systemServices',
        source: 'Router.swift:145 (RoachClawStatus.swift:905)',
        request: ['None.'],
        response: [
          'Array of services: Library (Kiwix), Academy (Kolibri), Chat (RoachInference), RoachSync, Notes, Data Lab.',
          'Each has `service_name`, `friendly_name`, `description`, `installed`, `installation_status`, `status`, `ui_location`.',
        ],
        implementation:
          'Only Chat reflects a live probe (whether the model server answers). Notes and Data Lab are built in and always report `running`. The rest report `available`.',
      },
      {
        id: 'system-services-install',
        method: 'POST',
        path: '/api/system/services/install',
        title: 'Install a service',
        summary: 'Starts the model server for `roachnet_ollama`. Acknowledges everything else.',
        handler: 'NativeRuntime.ensureOllama',
        source: 'Router.swift:193',
        body: { service_name: 'roachnet_ollama' },
        request: ['JSON body: `service_name`.'],
        response: ['`{ success: true, ok: true, message }`'],
        implementation:
          'Native services have nothing to install, so any name other than `roachnet_ollama` gets a success reply and no action.',
      },
      {
        id: 'system-services-affect',
        method: 'POST',
        path: '/api/system/services/affect',
        title: 'Start or stop a service',
        summary: 'Only `roachnet_ollama` with `start` does anything.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:200',
        body: { service_name: 'roachnet_ollama', action: 'start' },
        request: ['JSON body: `service_name`, `action`.'],
        response: ['`{ success: true, ok: true, message: "<action> request recorded." }`'],
        implementation:
          'Starting it brings up RoachInference’s Ollama-compatible model server inside the helper. With `ROACHNET_INFERENCE_ENGINE=ollama` and an Ollama you installed, that runner starts instead, with `OLLAMA_MODELS` pointed at `storage/models/ollama` and none of RoachNet’s own credentials in its environment. Any other combination gets the same reply and changes nothing.',
      },
      {
        id: 'system-ai-providers',
        method: 'GET',
        path: '/api/system/ai/providers',
        title: 'AI providers',
        summary: 'Whether the local model server is up, and which cloud keys exist.',
        handler: 'NativeRuntime.providerStatus',
        source: 'Router.swift:146',
        request: ['None.'],
        response: [
          '`providers.ollama` and `providers.openclaw`: `available`, `source`, `baseUrl`, `error`.',
          '`cloudProviders`: OpenAI, Anthropic and OpenRouter key status. Never the keys.',
        ],
        implementation:
          'The model server (RoachInference, or the Ollama you chose) is probed at `127.0.0.1:36434/api/version`, OpenClaw at `127.0.0.1:13001/health`. Probe results are cached for one second.',
      },
      {
        id: 'system-latest-version',
        method: 'GET',
        path: '/api/system/latest-version',
        title: 'Check for an update',
        summary: 'Compares this build with the newest GitHub release.',
        handler: 'NativeRuntime.latestVersionResponse',
        source: 'Router.swift:154 (RoachClawStatus.swift:1187)',
        query: 'force=1',
        request: ['Query: `force=1` skips the ten-minute cache.'],
        response: [
          '`{ success, updateAvailable, currentVersion, latestVersion, message, releaseUrl, assetUrl }`',
          'On failure: `success: false`, and `latestVersion` equals the current version.',
        ],
        implementation:
          'Reads the RoachWares/RoachNet releases list, skips drafts, and on the stable channel skips pre-releases. This and the update download are the only calls here that reach the internet on their own.',
      },
      {
        id: 'system-update',
        method: 'POST',
        path: '/api/system/update',
        title: 'Download the update',
        summary: 'Queues the verified installer DMG. Returns 202.',
        handler: 'NativeRuntime.requestUpdateDownload',
        source: 'Router.swift:156 (Downloads.swift:343)',
        request: ['No body needed.'],
        response: [
          '202 with `{ success, message, note }`.',
          '`success: false` when the release has no installer asset or no `.sha256` sidecar.',
        ],
        implementation:
          'Fetches the release’s `.sha256` sidecar first; the download refuses to finish unless the bytes match. The DMG lands in `storage/updates` and is opened for you. It does not install itself: run Setup over the existing install.',
      },
      {
        id: 'system-update-status',
        method: 'GET',
        path: '/api/system/update/status',
        title: 'Update progress',
        summary: 'Where the update download is.',
        handler: 'NativeRuntime.systemUpdateStatus',
        source: 'Router.swift:155',
        request: ['None.'],
        response: ['`{ stage, progress, message, timestamp }` where `stage` is `idle`, `checking`, `downloading`, `ready` or `error`.'],
        implementation: 'Mirrors the download job every 750 ms. In memory only.',
      },
    ],
  },
  {
    id: 'models',
    label: 'Models and chat',
    scope: 'runtime',
    summary: 'Local model inventory, chat and pulls through RoachInference, RoachNet’s Ollama-compatible model server. The routes keep their 1.0 names.',
    stack: 'RoachNet.app → roachnet-runtime → RoachInference model server on 127.0.0.1:36434',
    callers: ['RoachNet.app (RoachNetCore/ManagedAppRuntime.swift)'],
    endpoints: [
      {
        id: 'ollama-installed-models',
        method: 'GET',
        path: '/api/ollama/installed-models',
        title: 'Installed models',
        summary: 'The models the model server can load: its own and any in an Ollama models folder.',
        handler: 'NativeRuntime.installedModels',
        source: 'Router.swift:204 (RoachClawStatus.swift:55)',
        request: ['None.'],
        response: ['Array of `{ name, size }` from the model server’s `/api/tags`. Empty when it cannot answer.'],
        implementation: 'Starts the model server first if it is not running. Cached for about a second.',
      },
      {
        id: 'ollama-chat',
        method: 'POST',
        path: '/api/ollama/chat',
        title: 'Chat with a local model',
        summary: 'Passes your body to the model server’s /api/chat and returns its answer.',
        handler: 'NativeRuntime.handleChat',
        source: 'Router.swift:205 (Downloads.swift:697)',
        body: { model: 'qwen2.5-coder:1.5b', messages: [{ role: 'user', content: 'Say hello in five words.' }], stream: false },
        request: ['JSON body, forwarded as is: `model`, `messages`, `stream`, and any other Ollama chat option.'],
        response: [
          'The chat response, in Ollama’s format.',
          'If the model server is unreachable: still a 200, with `message.content` starting “Local model route is not ready”.',
        ],
        implementation:
          'Two-minute timeout. Streaming is not relayed, so send `stream: false` and get one JSON body back.',
      },
      {
        id: 'roachclaw-apply',
        method: 'POST',
        path: '/api/roachclaw/apply',
        title: 'Pull a model',
        summary: 'Queues a model pull and returns before it finishes.',
        handler: 'NativeRuntime.pullModel',
        source: 'Router.swift:189 (Downloads.swift:706)',
        body: { model: 'qwen2.5-coder:7b' },
        request: ['JSON body: `model`. Defaults to `qwen2.5-coder:1.5b`.'],
        response: ['`{ success: true, ok: true, message: "Local model pull queued." }`'],
        implementation:
          'The pull runs in the background against the model server’s `/api/pull` with a ten-minute timeout; RoachInference downloads from its catalog, resumes after a stall and checks the SHA-256 before it installs. The reply does not wait for it; a failed pull only shows up in the runtime log.',
      },
      {
        id: 'openclaw-skills-installed',
        method: 'GET',
        path: '/api/openclaw/skills/installed',
        title: 'OpenClaw skills',
        summary: 'Always an empty list in 1.1.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:206',
        request: ['None.'],
        response: ['`{ workspacePath, skills: [] }`'],
        implementation:
          'OpenClaw is a migration reference in 1.1, not a bundled runtime (RoachClawAgent.swift:110). The workspace path defaults to `storage/RoachClaw`.',
      },
    ],
  },
  {
    id: 'model-server',
    label: 'Model server',
    scope: 'models',
    summary: 'RoachInference’s own port: the Ollama, OpenAI and Anthropic APIs, for any client that speaks them.',
    stack: 'Any Ollama, OpenAI or Anthropic client → RoachInference model server on 127.0.0.1:36434',
    callers: ['RoachNet.app and RoachClaw', 'Your own tools (Open WebUI, editors, scripts)'],
    endpoints: [
      {
        id: 'ms-chat',
        method: 'POST',
        path: '/api/chat',
        title: 'Chat (Ollama)',
        summary: 'Ollama’s chat API, streamed as NDJSON unless `stream: false`.',
        handler: 'NativeModelServer.answerOllama',
        source: 'NativeModelServer.swift:286',
        body: { model: 'qwen3:0.6b', stream: false, think: false, messages: [{ role: 'user', content: 'Say hello in five words.' }] },
        request: ['`model`, `messages` (roles system, user, assistant, tool; `images` are refused), optional `tools`, `format` (`"json"` or a JSON Schema), `think`, `options` (`temperature`, `top_k`, `top_p`, `min_p`, `num_predict`, `num_ctx`, `seed`, `stop`, penalties) and `keep_alive`.'],
        response: ['Ollama’s chat reply: `message` (with `thinking` and `tool_calls` when there are any), `done_reason`, and the token counts and durations.'],
        implementation: 'Tool calls are parsed from the model’s own format and never streamed half-written. A JSON Schema is enforced while the model writes. `prompt_eval_count` counts only the tokens that were not already in the request slot’s cache.',
      },
      {
        id: 'ms-generate',
        method: 'POST',
        path: '/api/generate',
        title: 'Generate (Ollama)',
        summary: 'One prompt in, text out. `raw: true` skips the chat template; an empty prompt only loads the model.',
        handler: 'NativeModelServer.answerOllama',
        source: 'NativeModelServer.swift:284',
        body: { model: 'qwen3:0.6b', prompt: 'Why is the sky blue? One sentence.', stream: false },
        request: ['`model`, `prompt`, optional `system`, `raw`, `format`, `think`, `options`, `keep_alive`.'],
        response: ['Ollama’s generate reply, streamed as NDJSON unless `stream: false`.'],
        implementation: 'Same engine and options as chat.',
      },
      {
        id: 'ms-embed',
        method: 'POST',
        path: '/api/embed',
        title: 'Embeddings (Ollama)',
        summary: 'Vectors for one input or a list.',
        handler: 'NativeModelServer.answerEmbeddings',
        source: 'NativeModelServer.swift:290',
        body: { model: 'qwen3:0.6b', input: ['first', 'second'] },
        request: ['`model`, `input` (a string or a list), optional `truncate` and `dimensions`.'],
        response: ['`{ model, embeddings: [[…]], prompt_eval_count }`. Vectors are L2-normalized.'],
        implementation: '`/api/embeddings` (`prompt`, one vector, not normalized) answers the old shape.',
      },
      {
        id: 'ms-create',
        method: 'POST',
        path: '/api/create',
        title: 'Make a model',
        summary: 'A new model over an installed one or a local `.gguf`, with its own system prompt, parameters and messages.',
        handler: 'NativeModelServer.createModel',
        source: 'NativeModelServer.swift:288',
        body: { model: 'terse', from: 'qwen3:0.6b', system: 'Answer in one sentence.' },
        request: ['`model`, and `from` with optional `system`, `parameters`, `messages`, `template`; or a `modelfile` (`FROM`, `SYSTEM`, `PARAMETER`, `MESSAGE`).'],
        response: ['NDJSON statuses ending in `{ status: "success" }`, or one object with `stream: false`.'],
        implementation: 'The weights are hard-linked, not copied. `quantize`, adapters and uploaded files are refused with a 400.',
      },
      {
        id: 'ms-show',
        method: 'POST',
        path: '/api/show',
        title: 'Model details',
        summary: 'Architecture, parameters, template, capabilities and the Modelfile that makes it.',
        handler: 'NativeModelServer.show',
        source: 'NativeModelServer.swift:272',
        body: { model: 'qwen3:0.6b' },
        request: ['`model`.'],
        response: ['`{ modelfile, parameters, template, system, details, model_info, capabilities }`.'],
        implementation: '`capabilities` lists `completion`, and `tools`, `thinking` or `embedding` when the model can.',
      },
      {
        id: 'ms-ps',
        method: 'GET',
        path: '/api/ps',
        title: 'Loaded models',
        summary: 'What is in memory now.',
        handler: 'NativeModelServer.loadedSnapshot',
        source: 'NativeModelServer.swift:270',
        request: ['None.'],
        response: ['`{ models: [{ name, size, size_vram, context_length, backend, slots, expires_at }] }`.'],
        implementation: '`size` counts the weights, every request slot’s KV cache and the working buffers.',
      },
      {
        id: 'ms-tags',
        method: 'GET',
        path: '/api/tags',
        title: 'Installed models',
        summary: 'Every model the server can load, including those in an Ollama models folder, and plan models when they are on.',
        handler: 'NativeModelServer.store.list',
        source: 'NativeModelServer.swift:268',
        request: ['None.'],
        response: ['`{ models: [{ name, size, digest, details }] }`.'],
        implementation: 'Plan models (`claude:…`, `codex:…`) appear only when turned on in Settings and their CLI is installed and signed in.',
      },
      {
        id: 'ms-pull',
        method: 'POST',
        path: '/api/pull',
        title: 'Pull a model',
        summary: 'Downloads a model from the RoachNet catalog.',
        handler: 'NativeModelServer.pull',
        source: 'NativeModelServer.swift:274',
        body: { model: 'qwen3:0.6b', stream: false },
        request: ['`model`, optional `stream`.'],
        response: ['NDJSON progress ending in `{ status: "success" }`.'],
        implementation: 'Resumes after a stall, retries up to six times, and checks the SHA-256 before installing.',
      },
      {
        id: 'ms-copy',
        method: 'POST',
        path: '/api/copy',
        title: 'Copy a model',
        summary: 'A second name for a model; the weights are linked, not copied.',
        handler: 'NativeModelServer.copy',
        source: 'NativeModelServer.swift:282',
        body: { source: 'terse', destination: 'terse-2' },
        request: ['`source`, `destination`.'],
        response: ['200 with an empty body.'],
        implementation: 'A copy outlives the model it came from.',
      },
      {
        id: 'ms-delete',
        method: 'DELETE',
        path: '/api/delete',
        title: 'Delete a model',
        summary: 'Unloads it and removes it from the store.',
        handler: 'NativeModelServer.store.delete',
        source: 'NativeModelServer.swift:276',
        body: { model: 'terse-2' },
        request: ['`model`.'],
        response: ['200 with an empty body; 404 for an unknown model.'],
        implementation: 'Models read in place from an Ollama folder are left on disk.',
      },
      {
        id: 'ms-openai-chat',
        method: 'POST',
        path: '/v1/chat/completions',
        title: 'Chat completions (OpenAI)',
        summary: 'OpenAI’s chat API, streamed as server-sent events when `stream: true`.',
        handler: 'NativeModelServer.answerOpenAIChat',
        source: 'NativeModelServer.swift:306',
        body: { model: 'qwen3:0.6b', messages: [{ role: 'user', content: 'Name a color.' }], reasoning_effort: 'none' },
        request: ['`model`, `messages` (`developer` counts as `system`; content parts are joined), optional `tools`, `tool_choice`, `response_format` (`json_object` or `json_schema`), `reasoning_effort`, `max_tokens` / `max_completion_tokens`, `temperature`, `top_p`, `seed`, `stop`, `stream_options.include_usage`.'],
        response: ['A `chat.completion` (or `chat.completion.chunk` events ending in `[DONE]`), with `tool_calls` and `usage`.'],
        implementation: 'Errors come back in OpenAI’s error shape.',
      },
      {
        id: 'ms-openai-completions',
        method: 'POST',
        path: '/v1/completions',
        title: 'Completions (OpenAI)',
        summary: 'Plain text completion of a prompt.',
        handler: 'NativeModelServer.answerCompletions',
        source: 'NativeModelServer.swift:308',
        body: { model: 'qwen3:0.6b', prompt: 'Once upon a time', max_tokens: 16 },
        request: ['`model`, `prompt`, optional `max_tokens`, `temperature`, `stop`, `stream`.'],
        response: ['A `text_completion` object, or SSE chunks.'],
        implementation: 'No chat template is applied.',
      },
      {
        id: 'ms-openai-responses',
        method: 'POST',
        path: '/v1/responses',
        title: 'Responses (OpenAI)',
        summary: 'OpenAI’s Responses API, with function tools and structured output.',
        handler: 'NativeModelServer.answerResponses',
        source: 'NativeModelServer.swift:310',
        body: { model: 'qwen3:0.6b', input: 'Name a planet.', reasoning: { effort: 'none' } },
        request: ['`model`, `input` (a string or input items, including `function_call_output`), optional `instructions`, `tools`, `text.format`, `reasoning`, `max_output_tokens`, `stream`.'],
        response: ['A `response` object with `output` items (`message`, `function_call`, `reasoning`), or the `response.*` event stream.'],
        implementation: 'Nothing is stored between calls; send the history you want each time.',
      },
      {
        id: 'ms-openai-embeddings',
        method: 'POST',
        path: '/v1/embeddings',
        title: 'Embeddings (OpenAI)',
        summary: 'OpenAI’s embeddings shape.',
        handler: 'NativeModelServer.answerEmbeddings',
        source: 'NativeModelServer.swift:294',
        body: { model: 'qwen3:0.6b', input: 'hello' },
        request: ['`model`, `input`, optional `dimensions`, `encoding_format` (`float` or `base64`).'],
        response: ['`{ object: "list", data: [{ embedding, index }], usage }`.'],
        implementation: 'Same vectors as `/api/embed`.',
      },
      {
        id: 'ms-openai-models',
        method: 'GET',
        path: '/v1/models',
        title: 'Models (OpenAI)',
        summary: 'The installed models in OpenAI’s list shape; `/v1/models/:id` answers one.',
        handler: 'NativeModelServer.store.list',
        source: 'NativeModelServer.swift:296',
        request: ['None.'],
        response: ['`{ object: "list", data: [{ id, object: "model", owned_by: "roachnet" }] }`.'],
        implementation: 'Plan models are listed when they are on.',
      },
      {
        id: 'ms-anthropic-messages',
        method: 'POST',
        path: '/v1/messages',
        title: 'Messages (Anthropic)',
        summary: 'Anthropic’s Messages API, streamed as its event stream when `stream: true`.',
        handler: 'NativeModelServer.answerAnthropic',
        source: 'NativeModelServer.swift:312',
        body: { model: 'qwen3:0.6b', max_tokens: 64, messages: [{ role: 'user', content: 'Say hi.' }] },
        request: ['`model`, `max_tokens`, `messages` (text, `tool_use` and `tool_result` blocks), optional `system`, `tools`, `tool_choice`, `thinking`, `temperature`, `stop_sequences`.'],
        response: ['A `message` with `text`, `thinking` and `tool_use` blocks, `stop_reason` and `usage`; or `message_start` … `message_stop` events.'],
        implementation: 'Errors come back in Anthropic’s error shape.',
      },
      {
        id: 'ms-anthropic-count',
        method: 'POST',
        path: '/v1/messages/count_tokens',
        title: 'Count tokens (Anthropic)',
        summary: 'How many tokens a Messages request would send.',
        handler: 'NativeModelServer.countAnthropicTokens',
        source: 'NativeModelServer.swift:314',
        body: { model: 'qwen3:0.6b', messages: [{ role: 'user', content: 'Say hi.' }] },
        request: ['The same body as `/v1/messages`, without `max_tokens`.'],
        response: ['`{ input_tokens }`.'],
        implementation: 'Counted with the model’s own tokenizer and template.',
      },
    ],
  },
  {
    id: 'cluster',
    label: 'RoachNet Cluster',
    scope: 'runtime',
    summary: 'Split one model across several Macs on your network.',
    stack: 'RoachNet.app → loopback API → ClusterNode',
    callers: ['RoachNet.app (Settings › Models › RoachNet Cluster)'],
    endpoints: [
      {
        id: 'cluster-status',
        method: 'GET',
        path: '/api/cluster',
        title: 'Cluster status',
        summary: 'This Mac, the other Macs, the pairing code and how loaded models are split.',
        handler: 'NativeRuntime.routeCluster',
        source: 'ClusterRoutes.swift:15',
        query: 'refresh=1',
        request: ['Optional `refresh=1` asks the other Macs now.'],
        response: ['`{ id, name, version, chip, memory: { total, budget, free }, stages, enabled, mode, port, listening, paired, code, fingerprint, peers, models }`. With `refresh=1`, each peer carries its own status and `reachable`.'],
        implementation: 'The pairing code is shown only on this loopback API, never to the other Macs.',
      },
      {
        id: 'cluster-update',
        method: 'PUT',
        path: '/api/cluster',
        title: 'Change cluster settings',
        summary: 'Turn the cluster on or off, rename this Mac, choose when models are split, join a cluster or start a new one.',
        handler: 'ClusterNode.update',
        source: 'ClusterRoutes.swift:20',
        body: { enabled: true, mode: 'auto' },
        request: ['Any of `enabled`, `name`, `mode` (`"auto"`: only models too big for this Mac; `"always"`: every model), `peers`, `code` (join that cluster), `resetPairing: true`.'],
        response: ['The new status.'],
        implementation: 'Settings are stored readable by your account only. A new pairing code means the other Macs need the new code.',
      },
      {
        id: 'cluster-nearby',
        method: 'GET',
        path: '/api/cluster/nearby',
        title: 'Macs nearby',
        summary: 'RoachNet Macs advertising on the local network.',
        handler: 'ClusterNode.nearby',
        source: 'ClusterRoutes.swift:17',
        request: ['None.'],
        response: ['`{ macs: [{ name, address, sameCluster, added }] }`; empty while the cluster is off.'],
        implementation: 'Found over Bonjour (`_roachnet-cluster._tcp`). A Mac still needs the pairing code to join.',
      },
      {
        id: 'cluster-peer-add',
        method: 'POST',
        path: '/api/cluster/peers',
        title: 'Add a Mac',
        summary: 'Adds another Mac by address and asks it for its status.',
        handler: 'NativeRuntime.routeCluster',
        source: 'ClusterRoutes.swift:24',
        body: { address: 'studio.local' },
        request: ['`address`: a host name or IP, with `:port` if it is not 7419.'],
        response: ['The new status.'],
        implementation: '`DELETE /api/cluster/peers` with the same body removes one.',
      },
    ],
  },
  {
    id: 'traces',
    label: 'RoachTrace',
    scope: 'runtime',
    summary: 'Traces of every Org run, RoachClaw chat and model call, kept on this Mac.',
    stack: 'RoachNet.app → loopback API → Tracer (storage/state/traces)',
    callers: ['RoachNet.app (Org › Traces, Settings › RoachClaw › Tracing)'],
    endpoints: [
      {
        id: 'traces-list',
        method: 'GET',
        path: '/api/traces',
        title: 'Traces',
        summary: 'Recent traces, newest first: Org runs, RoachClaw chats and model calls.',
        handler: 'NativeRuntime.listTraces',
        source: 'TraceRoutes.swift:13',
        query: 'limit=20',
        request: ['Optional filters `kind`, `status`, `agentId`, `issueId`, `sessionId`, `runId`, `tag`, `q`, `from`, `to`, `companyId`; `limit` (50), `cursor`; `content=1` adds inputs and outputs.'],
        response: ['`{ traces: [{ id, kind, name, status, startTime, endTime, latencyMs, usage, costUsd, observationCount, tags, … }], nextCursor }`.'],
        implementation: 'Read scope is enough. Inputs and outputs had secrets scrubbed before they were written.',
      },
      {
        id: 'traces-metrics',
        method: 'GET',
        path: '/api/traces/metrics',
        title: 'Trace totals',
        summary: 'Tokens, cost and latency rolled up by one field.',
        handler: 'NativeRuntime.traceMetrics',
        source: 'TraceRoutes.swift:15',
        request: ['`groupBy`: `kind` (default), `agent`, `name`, `day`, `model` or `provider`; the same filters as the list.'],
        response: ['The totals for each group.'],
        implementation: 'Cached tokens are counted apart from new ones.',
      },
      {
        id: 'traces-detail',
        method: 'GET',
        path: '/api/traces/:id',
        title: 'One trace',
        summary: 'A trace with its observations (spans, generations, tool calls) and scores.',
        handler: 'NativeRuntime.traceDetail',
        source: 'TraceRoutes.swift:26',
        request: ['The trace id in the path.'],
        response: ['The trace’s fields with its `observations` and `scores`.'],
        implementation: '`DELETE /api/traces/:id` removes one.',
      },
      {
        id: 'traces-score',
        method: 'POST',
        path: '/api/traces/:id/scores',
        title: 'Score a trace',
        summary: 'Adds a score (a number, a label or yes/no) to a trace or one of its observations.',
        handler: 'NativeRuntime.addTraceScore',
        source: 'TraceRoutes.swift:31',
        body: { name: 'helpful', value: 1 },
        request: ['`name`, `value` (a number, `true`/`false` or a label), optional `dataType`, `observationId`, `comment`, `source`.'],
        response: ['201 with the score.'],
        implementation: 'Needs the admin scope.',
      },
      {
        id: 'traces-settings',
        method: 'GET',
        path: '/api/traces/settings',
        title: 'Tracing settings',
        summary: 'What is traced, how long it is kept, and where it is exported.',
        handler: 'NativeRuntime.traceSettingsJSON',
        source: 'TraceRoutes.swift:17',
        request: ['None.'],
        response: ['`{ enabled, captureContent, maxContentChars, retentionDays, traceModelServer, export: { enabled, endpoint, includeContent, headerNames, serviceName, environment, pending, lastResult }, pricing, storagePath }`.'],
        implementation: '`PUT /api/traces/settings` changes them. Export header values (API keys) are stored and never sent back; only their names are.',
      },
      {
        id: 'traces-export-test',
        method: 'POST',
        path: '/api/traces/export/test',
        title: 'Test the export',
        summary: 'Sends one test span to the configured Langfuse or OpenTelemetry endpoint.',
        handler: 'TraceExporter.test',
        source: 'TraceRoutes.swift:21',
        request: ['None.'],
        response: ['`{ ok, … }` with the collector’s answer.'],
        implementation: '`POST /api/traces/export/flush` sends whatever is waiting.',
      },
    ],
  },
  {
    id: 'roachclaw',
    label: 'RoachClaw agent',
    scope: 'runtime',
    summary: 'Status, readiness, the plan-only agent and the guardrails around it.',
    stack: 'Loopback API → NativeRuntime (RoachClawStatus, RoachClawAgent, RoachClawStores)',
    callers: ['RoachNet.app reads status; the rest is open to local tools on this Mac'],
    endpoints: [
      {
        id: 'roachclaw-status',
        method: 'GET',
        path: '/api/roachclaw/status',
        title: 'RoachClaw status',
        summary: 'Everything RoachClaw knows about itself, in one heavy read.',
        handler: 'NativeRuntime.roachClawStatus',
        source: 'Router.swift:157 (RoachClawStatus.swift:151)',
        request: ['None.'],
        response: [
          '`ready` (true when the model server answers), `defaultModel`, `resolvedDefaultModel`, `installedModels`, `modelRecords`.',
          '`ollama`, `openclaw`, `agent`, `operations`, `playbook`, `workspacePath`.',
        ],
        implementation:
          'Probes the model server, OpenClaw and the model list in parallel, then summarizes every store. Good for a status screen, heavy for a loop.',
        usedBy: ['RoachNet.app (RoachNetCore/ManagedAppRuntime.swift)'],
      },
      {
        id: 'roachclaw-readiness',
        method: 'GET',
        path: '/api/roachclaw/readiness',
        title: 'Readiness',
        summary: 'Whether RoachClaw can write where it needs to.',
        handler: 'NativeRuntime.roachClawReadinessState',
        source: 'Router.swift:184',
        request: ['None.'],
        response: ['`{ ready, localFirst, version, checks, timestamp }`'],
        implementation:
          'Writes and deletes a probe file in the storage root, the runtime state root and `storage/Vault`. `localFirst` is false only if storage is a URL or a relative path.',
      },
      {
        id: 'roachclaw-agent-status',
        method: 'GET',
        path: '/api/roachclaw/agent/status',
        title: 'Agent status',
        summary: 'The agent block: skills, policy, budgets, memory location.',
        handler: 'RoachClawAgent.status',
        source: 'Router.swift:185',
        request: ['None.'],
        response: [
          '`runtime: "roachclaw-native-agent"`, `skills`, `policy.defaultExecutionMode: "plan-only"`, `budgets`, `memory`.',
        ],
        implementation:
          'Its `ready` flag is always false in 1.1, because the status is built without model state (RoachClawStatus.swift:171). Read `ready` from /api/roachclaw/status instead.',
      },
      {
        id: 'roachclaw-agent-run',
        method: 'POST',
        path: '/api/roachclaw/agent/run',
        title: 'Plan an agent run',
        summary: 'Builds the permissioned prompt packet and a plan. Runs nothing.',
        handler: 'RoachClawAgent.createRun',
        source: 'Router.swift:186 (RoachClawAgent.swift:163)',
        body: { prompt: 'List what changed in my vault this week', enabledScopes: ['vault'], context: { vault: 'notes/2026-10-08.md was edited' } },
        request: [
          '`prompt` (required).',
          '`enabledScopes`: any of `roachnet`, `dev`, `vault`, `archives`, `arcade`, `maps`, `media`, `settings`, `runtime`. Defaults to `roachnet`.',
          '`context`: an object keyed by scope. Only enabled scopes are read.',
          '`contextBudget`: 1,000 to 64,000 characters, default 12,000. Also `model`, `activeSurface`, `execute`.',
        ],
        response: [
          '`executed: false`, always.',
          '`executionMode`: `plan-only`, or `approval-required` when you send `execute: true`.',
          '`prompt`: the system and user messages it would send. Also `plan`, `toolPolicy`, `budgets`.',
          '500 when `prompt` is empty.',
        ],
        implementation:
          'No model is called and no tool runs. Approval-gated execution is not wired up in 1.1, and the reply says so.',
      },
      {
        id: 'roachclaw-operations',
        method: 'GET',
        path: '/api/roachclaw/operations',
        title: 'Operations snapshot',
        summary: 'Every store and lane summarized. Add a section name for one part.',
        handler: 'NativeRuntime.roachClawOperationsState',
        source: 'Router.swift:341',
        request: [
          'Optional last segment selects one section: `/api/roachclaw/operations/jobs`. An unknown section returns the whole object.',
        ],
        response: [
          'Sections include `diagnostics`, `serviceHealth`, `jobs`, `contacts`, `calendar`, `mail`, `apiTokens`, `cloudProviders`, `readiness`, `toolPolicy`, `backups` and `models`.',
        ],
        implementation: 'Computed on every call, same cost as /api/roachclaw/status.',
      },
      {
        id: 'roachclaw-diagnostics-services',
        method: 'GET',
        path: '/api/roachclaw/diagnostics/services',
        title: 'Service health report',
        summary: 'Per-lane health for models, agent, memory, embeddings and limits.',
        handler: 'NativeRuntime.roachClawServiceHealthState',
        source: 'Router.swift:158',
        request: ['None.'],
        response: ['The `operations.serviceHealth.report` block from /api/roachclaw/status.'],
        implementation: 'A slice of the status call, so it costs the same.',
      },
      {
        id: 'roachclaw-scoped-tools',
        method: 'GET',
        path: '/api/roachclaw/scoped-tools/capabilities',
        title: 'Scoped tool bridge',
        summary: 'The scopes and endpoints a scoped tool is meant to use.',
        handler: 'NativeRuntime.roachClawScopedToolBridgeState',
        source: 'Router.swift:165 (RoachClawStores.swift:1000)',
        request: ['None.'],
        response: ['`localOnly: true`, `approvalRequired: true`, the scope list (`todos:write`, `email:send` and so on) and six endpoints.'],
        implementation: 'A declaration, not a gate. The loopback API checks API-token scopes (`chat`, `read`, `admin`), not these tool scopes.',
      },
      {
        id: 'roachclaw-workspace-browse',
        method: 'GET',
        path: '/api/roachclaw/workspace/browse',
        title: 'Browse folders',
        summary: 'Lists the subfolders of a folder on this Mac.',
        handler: 'NativeRuntime.browseRoachClawWorkspace',
        source: 'Router.swift:159 (RoachClawStores.swift:830)',
        query: 'path=$HOME/Projects',
        request: ['Query: `path`. If it is missing or not a folder, you get your home folder (or `ROACHNET_WORKSPACE_BROWSE_ROOT`).'],
        response: ['`{ path, parent, dirs: [{ name, path, modifiedAt }], count }`'],
        implementation: 'Folders only, no files. Hidden folders and symlinks are skipped.',
      },
      {
        id: 'roachclaw-tool-policy',
        method: 'GET',
        path: '/api/roachclaw/tool-policy',
        title: 'Tool policy',
        summary: 'Which tools are disabled, and whether this turn is guide-only.',
        handler: 'NativeRuntime.roachClawToolPolicyState',
        source: 'Router.swift:176',
        request: ['None.'],
        response: ['`mode` (`normal` or `guide_only`), `disabledTools`, `hiddenTools`, `reasons`, `knownToolCount`, `enforcement`.'],
        implementation: 'Known tools are the built-in list plus anything in the tool index.',
      },
      {
        id: 'roachclaw-tool-policy-save',
        method: 'POST',
        path: '/api/roachclaw/tool-policy',
        title: 'Save disabled tools',
        summary: 'Replaces the saved list of disabled tools.',
        handler: 'NativeRuntime.upsertRoachClawToolPolicy',
        source: 'Router.swift:177',
        body: { disabledTools: ['bash', 'send_email'] },
        request: ['JSON body: `disabledTools` (up to 200 names). `lastUserMessage` is evaluated too, but not saved.'],
        response: ['The evaluated policy.'],
        implementation: 'The list is replaced, not merged. Send the full list every time.',
      },
      {
        id: 'roachclaw-tool-policy-evaluate',
        method: 'POST',
        path: '/api/roachclaw/tool-policy/evaluate',
        title: 'Evaluate a turn',
        summary: 'Applies the policy to one message without saving anything.',
        handler: 'NativeRuntime.roachClawToolPolicyState',
        source: 'Router.swift:178',
        body: { lastUserMessage: 'Do not use any tools, just explain it.' },
        request: ['JSON body: `lastUserMessage` (or `message`), optional extra `disabledTools`.'],
        response: ['The policy for that turn: `blockAllToolCalls`, `guideOnlyReason`, `hiddenTools`.'],
        implementation:
          'If the message asks for no tools (“guide-only mode”, “do not use tools”, “ask before using tools”), every known tool is disabled and hidden and `blockAllToolCalls` is true.',
      },
      {
        id: 'roachclaw-context-budget',
        method: 'GET',
        path: '/api/roachclaw/context-budget',
        title: 'Context budget',
        summary: 'How much context RoachClaw may spend per prompt.',
        handler: 'NativeRuntime.roachClawContextBudgetState',
        source: 'Router.swift:179',
        request: ['None.'],
        response: ['`configuredBudget` (default 6,000), `modelContextLength`, `headroom` (default 0.85), `hardMax` (default 200,000), `effectiveBudget`.'],
        implementation: 'Without a saved profile you get the defaults.',
      },
      {
        id: 'roachclaw-context-budget-save',
        method: 'POST',
        path: '/api/roachclaw/context-budget',
        title: 'Set the context budget',
        summary: 'Saves one budget profile and returns the result.',
        handler: 'NativeRuntime.upsertRoachClawContextBudget',
        source: 'Router.swift:180',
        body: { modelContextLength: 32768, headroom: 0.85 },
        request: ['JSON body: `configuredBudget`, `modelContextLength`, `explicit`, `headroom` (0.1 to 0.95), `hardMax` (1,024 to 1,000,000).'],
        response: ['The computed budget.'],
        implementation:
          'With a model context length, the effective budget is length × headroom, capped at `hardMax`. With `explicit: true` your configured number wins, capped at the model length.',
      },
      {
        id: 'roachclaw-url-safety',
        method: 'POST',
        path: '/api/roachclaw/url-safety/check',
        title: 'Check an outbound URL',
        summary: 'Would RoachNet fetch this URL? Resolves it and says why not.',
        handler: 'NativeRuntime.checkRoachClawOutboundUrl',
        source: 'Router.swift:181 (RoachClawStores.swift:1563)',
        body: { url: 'https://example.com/file.zim', blockPrivate: true },
        request: ['JSON body: `url`, optional `blockPrivate`.'],
        response: ['`{ ok, reason }`'],
        implementation:
          'Rejects non-HTTP schemes, hosts that do not resolve, link-local addresses (169.254/16 and fe80::, where cloud metadata lives), multicast and unspecified addresses. `blockPrivate` also rejects loopback and private ranges. Paired phones get this check automatically on /api/companion/install.',
      },
      {
        id: 'roachclaw-user-time',
        method: 'GET',
        path: '/api/roachclaw/user-time',
        title: 'User time',
        summary: 'Your time zone, plus a sentence ready to drop into a prompt.',
        handler: 'NativeRuntime.roachClawUserTimeState',
        source: 'Router.swift:160',
        request: ['None.'],
        response: ['`timeZoneName`, `utcOffset`, `localDateTime`, `promptContext`, `configured`.'],
        implementation: 'Defaults to the Mac’s own time zone until you save one.',
      },
      {
        id: 'roachclaw-user-time-save',
        method: 'POST',
        path: '/api/roachclaw/user-time',
        title: 'Set user time',
        summary: 'Saves the time zone RoachClaw should assume.',
        handler: 'NativeRuntime.upsertRoachClawUserTime',
        source: 'Router.swift:161',
        body: { timeZoneName: 'America/Chicago' },
        request: ['JSON body: `timeZoneName` (or `timezone`), optional `utcOffsetMinutes`.'],
        response: ['The new user-time state.'],
        implementation: 'Offsets are clamped to ±14 hours.',
      },
    ],
  },
  {
    id: 'roachclaw-settings',
    label: 'RoachClaw keys and lanes',
    scope: 'runtime',
    summary: 'Provider keys, API tokens, memory, OAuth, embeddings, TLS and upload limits.',
    stack: 'Loopback API → NativeRuntime (RoachClawStores) → storage/.runtime/roachclaw',
    callers: ['Local tools on this Mac (RoachNet.app shows the summaries from /api/roachclaw/status)'],
    endpoints: [
      {
        id: 'roachclaw-subscriptions',
        method: 'GET',
        path: '/api/roachclaw/subscriptions',
        title: 'Plan models',
        summary: 'Whether Claude and ChatGPT plan models are on, and whether their CLIs are installed and signed in.',
        handler: 'SubscriptionModels.status',
        source: 'Router.swift:270',
        request: ['None.'],
        response: ['`{ subscriptions: [{ provider, providerLabel, enabled, installed, signedIn, version, authMethod, modelNames, … }] }`.'],
        implementation: 'RoachNet asks each CLI’s own status command and never reads its credentials.',
      },
      {
        id: 'roachclaw-subscriptions-save',
        method: 'PUT',
        path: '/api/roachclaw/subscriptions',
        title: 'Turn plan models on or off',
        summary: 'Turns `claude:…` and `codex:…` models on or off.',
        handler: 'SubscriptionModels.update',
        source: 'Router.swift:271',
        body: { claude: true },
        request: ['`claude` and/or `codex`: `true` or `false`.'],
        response: ['The new status.'],
        implementation: 'Off by default. Replies come from your own Claude Code or Codex CLI, with no tools, in an empty folder.',
      },
      {
        id: 'roachclaw-cloud-providers',
        method: 'GET',
        path: '/api/roachclaw/cloud-providers',
        title: 'Cloud provider keys',
        summary: 'Which optional cloud lanes have a key. Never the key.',
        handler: 'NativeRuntime.roachClawPublicCloudProviderKeysState',
        source: 'Router.swift:280',
        request: ['None.'],
        response: [
          'OpenAI, Anthropic and OpenRouter, each with `configured`, `configuredVia` (`environment`, `local-secret-file` or `none`), `isActive`, `baseUrl`, `envVar`.',
        ],
        implementation: 'Cloud lanes are opt-in. A key in `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` counts as configured.',
      },
      {
        id: 'roachclaw-cloud-providers-save',
        method: 'POST',
        path: '/api/roachclaw/cloud-providers',
        title: 'Save a provider key',
        summary: 'Stores one cloud key on this Mac, readable only by you.',
        handler: 'NativeRuntime.upsertRoachClawCloudProviderKey',
        source: 'Router.swift:281',
        body: { provider: 'openrouter', key: 'sk-or-REPLACE-ME' },
        request: ['JSON body: `provider` (`openai`, `anthropic`, `openrouter`), `key`, optional `baseUrl`, `scopes`, `isActive`.'],
        response: ['`{ success, ok, provider, state }` with the key left out.'],
        implementation:
          'The key goes into a 0600 file under the runtime state folder; the index keeps only its SHA-256. Keys over 8 KB are refused, and a custom `baseUrl` must be a public host. Missing key: 500.',
      },
      {
        id: 'roachclaw-cloud-providers-delete',
        method: 'DELETE',
        path: '/api/roachclaw/cloud-providers/:provider',
        examplePath: '/api/roachclaw/cloud-providers/openrouter',
        title: 'Remove a provider key',
        summary: 'Deletes the index entry and the key file.',
        handler: 'NativeRuntime.deleteRoachClawCloudProviderKey',
        source: 'Router.swift:360',
        request: ['Path: the provider id.'],
        response: ['`{ success, ok, deleted, provider, state }`'],
        implementation: 'Only the runtime’s own copy is deleted. A legacy copy under `storage/vault` is left where it is.',
      },
      {
        id: 'roachclaw-tokens',
        method: 'GET',
        path: '/api/roachclaw/tokens',
        title: 'API tokens',
        summary: 'Tokens you have issued, without their hashes.',
        handler: 'NativeRuntime.roachClawPublicApiTokensState',
        source: 'Router.swift:269',
        request: ['None.'],
        response: ['`tokens`: `id`, `name`, `owner`, `scopes`, `isActive`, `lastUsedAt`.'],
        implementation: 'Hashes are stripped before they leave the runtime.',
      },
      {
        id: 'roachclaw-tokens-create',
        method: 'POST',
        path: '/api/roachclaw/tokens',
        title: 'Issue an API token',
        summary: 'Mints an `rn_` token and shows it once.',
        handler: 'NativeRuntime.createRoachClawApiToken',
        source: 'Router.swift:279',
        body: { name: 'Shortcuts', scopes: ['chat'] },
        request: ['JSON body: `name`, `owner`, `scopes` (default `["chat"]`), `isActive`.'],
        response: ['`token`: the raw value. Copy it now; it is never returned again. Also `record` and `state`.'],
        implementation:
          'Only the SHA-256 is kept. Since 1.1 the loopback API accepts these tokens: `chat` opens the chat routes, `read` every GET, `admin` everything. A token without the scope a route needs gets a 403 that names it.',
      },
      {
        id: 'roachclaw-tokens-delete',
        method: 'DELETE',
        path: '/api/roachclaw/tokens/:id',
        examplePath: '/api/roachclaw/tokens/token_0123456789ab',
        title: 'Revoke an API token',
        summary: 'Deletes one token record.',
        handler: 'NativeRuntime.deleteRoachClawApiToken',
        source: 'Router.swift:359',
        request: ['Path: the token `id` (not the token).'],
        response: ['`{ success, ok, deleted, id, state }`'],
        implementation: '`deleted: false` means nothing had that id.',
      },
      {
        id: 'roachclaw-memory-provider',
        method: 'GET',
        path: '/api/roachclaw/memory-provider',
        title: 'Memory providers',
        summary: 'RoachBrain native memory, plus any external providers you added.',
        handler: 'NativeRuntime.roachClawMemoryProviderState',
        source: 'Router.swift:170',
        request: ['None.'],
        response: ['`providers`: `roachbrain-native` first (always enabled, local), then yours.'],
        implementation: 'The native provider keeps its records in `memories.json` in the RoachClaw state folder.',
      },
      {
        id: 'roachclaw-memory-provider-save',
        method: 'POST',
        path: '/api/roachclaw/memory-provider',
        title: 'Add a memory provider',
        summary: 'Records an external provider. Off unless you say otherwise.',
        handler: 'NativeRuntime.upsertRoachClawMemoryProvider',
        source: 'Router.swift:171',
        body: { id: 'notes-index', displayName: 'Notes index', enabled: false },
        request: ['JSON body: `id`, `providerId`, `displayName`, `enabled`, `localFirst`, `tools`.'],
        response: ['The updated provider list.'],
        implementation: 'External providers default to `enabled: false`. The native provider cannot be replaced.',
      },
      {
        id: 'roachclaw-provider-oauth',
        method: 'GET',
        path: '/api/roachclaw/provider-oauth',
        title: 'Provider OAuth flows',
        summary: 'Pending and active OAuth flows for remote tools, minus the tokens.',
        handler: 'NativeRuntime.roachClawProviderOAuthState',
        source: 'Router.swift:172',
        request: ['None.'],
        response: ['`redirectBase: "roachnet://provider-oauth/callback"`, `authWaitSeconds: 300`, `flows`.'],
        implementation: 'Token fields are stripped from every flow before it is returned.',
      },
      {
        id: 'roachclaw-provider-oauth-save',
        method: 'POST',
        path: '/api/roachclaw/provider-oauth',
        title: 'Record an OAuth flow',
        summary: 'Adds or updates one flow record.',
        handler: 'NativeRuntime.upsertRoachClawProviderOAuthFlow',
        source: 'Router.swift:173',
        body: { provider: 'mcp-server', serverUrl: 'https://mcp.example.com', scopes: ['read'] },
        request: ['JSON body: `id`, `provider`, `serverUrl` (public hosts only), `scopes`, `status`, `isActive`.'],
        response: ['The updated flow list.'],
        implementation: 'An `authUrl` is stored as `[redacted-user-auth-url]`. This records a flow; it does not open a browser.',
      },
      {
        id: 'roachclaw-embedding-lanes',
        method: 'GET',
        path: '/api/roachclaw/embedding-lanes',
        title: 'Embedding lanes',
        summary: 'The local RoachBrain lane and the optional custom one.',
        handler: 'NativeRuntime.roachClawEmbeddingLanesState',
        source: 'Router.swift:174',
        request: ['None.'],
        response: ['Lanes with endpoint, model, dimension (384 by default locally), indexed counts, fingerprints and health.'],
        implementation: 'The local lane is `local://roachbrain`. An incomplete custom lane is reported and never promoted.',
      },
      {
        id: 'roachclaw-embedding-lanes-save',
        method: 'POST',
        path: '/api/roachclaw/embedding-lanes',
        title: 'Configure the custom lane',
        summary: 'Points the custom embedding lane at an endpoint and model.',
        handler: 'NativeRuntime.upsertRoachClawEmbeddingLane',
        source: 'Router.swift:175',
        body: { id: 'custom', endpointUrl: 'http://127.0.0.1:8081/embed', model: 'nomic-embed-text', dimension: 768 },
        request: ['JSON body: `endpointUrl`, `model`, `dimension`, `enabled`, optional `reset: true`.'],
        response: ['The updated lanes.'],
        implementation: 'Only the `custom` lane can be set here; any other id is a 400. `reset: true` records a reset time.',
      },
      {
        id: 'roachclaw-tls-overrides',
        method: 'GET',
        path: '/api/roachclaw/security/tls-overrides',
        title: 'TLS CA bundle',
        summary: 'Whether a custom CA bundle is set for model provider probes.',
        handler: 'NativeRuntime.roachClawTlsOverridesState',
        source: 'Router.swift:166',
        request: ['None.'],
        response: ['`configured`, `valid`, `bundleLabel`. The path itself comes back as `[local-path-redacted]`.'],
        implementation: '`insecureDisableAllowed` is false. There is no switch to turn verification off.',
      },
      {
        id: 'roachclaw-tls-overrides-save',
        method: 'POST',
        path: '/api/roachclaw/security/tls-overrides',
        title: 'Set a CA bundle',
        summary: 'Adds a PEM bundle on top of system trust, for provider probes only.',
        handler: 'NativeRuntime.upsertRoachClawTlsOverride',
        source: 'Router.swift:167',
        body: { bundlePath: '~/certs/office-ca.pem' },
        request: ['JSON body: `bundlePath`. Empty clears it.'],
        response: ['The new TLS state.', '400 if the path is not a local file.'],
        implementation: 'System trust stays in place; the bundle is added to it.',
      },
      {
        id: 'roachclaw-upload-limits',
        method: 'GET',
        path: '/api/roachclaw/security/upload-limits',
        title: 'Upload limits',
        summary: 'Every hard cap, with the env var that tunes it.',
        handler: 'NativeRuntime.roachClawUploadLimitsState',
        source: 'Router.swift:168',
        request: ['None.'],
        response: ['`limits`: chat uploads 10 MB, gallery 100 MB, gallery transforms 25 MB, vault imports 25 MB, memory imports 10 MB, JSON bodies 1 MB, and the rest.'],
        implementation: 'Defaults shown; each is overridable with its `ROACHNET_*` variable.',
      },
      {
        id: 'roachclaw-migration-document-tools',
        method: 'GET',
        path: '/api/roachclaw/migration-document-tools',
        title: 'Migration and document tools',
        summary: 'Formats and sources RoachClaw can import from.',
        handler: 'NativeRuntime.roachClawMigrationDocumentToolsState',
        source: 'Router.swift:169',
        request: ['None.'],
        response: ['Office formats (`docx`, `pptx`, `xlsx`…), document languages, migration sources (ChatGPT exports, Claude projects, Codex sessions, memory JSON, Markdown trees) and validators.'],
        implementation: 'A capability description. The import itself happens in the app.',
      },
    ],
  },
  {
    id: 'roachclaw-stores',
    label: 'RoachClaw stores',
    scope: 'runtime',
    summary: 'Contacts, tasks, calendar, mail and the rest: local JSON stores with list, upsert and delete.',
    stack: 'Loopback API → NativeRuntime (RoachClawStores) → JSON files in storage/.runtime/roachclaw',
    callers: ['Local tools on this Mac (RoachNet.app shows the summaries from /api/roachclaw/status)'],
    endpoints: [
      {
        id: 'roachclaw-store-list',
        method: 'GET',
        path: '/api/roachclaw/:collection',
        examplePath: '/api/roachclaw/tasks',
        title: 'List a store',
        summary: 'Reads one of sixteen local stores.',
        handler: 'NativeRuntime.roachClaw…State',
        source: 'Router.swift:369 (table at :80)',
        request: [
          '`:collection` is one of `contacts`, `tasks`, `calendar`, `reports`, `memories`, `skills`, `editor-drafts`, `search-cache`, `gallery`, `webhooks`, `agent-runs`, `context-compactions`, `tool-index`, `events`, `presets`, `signatures`.',
        ],
        response: [
          '`{ schema, updatedAt, <key>: [...] }`.',
          'The array key usually matches the path. Exceptions: `events` (calendar), `drafts` (editor-drafts), `entries` (search-cache), `assets` (gallery), `runs` (agent-runs), `compactions` (context-compactions), `tools` (tool-index), `templates` (presets).',
        ],
        implementation:
          'Each store is a JSON file under `storage/.runtime/roachclaw/`. The older `storage/vault/roachclaw/` copy is read as a fallback, never written.',
      },
      {
        id: 'roachclaw-store-upsert',
        method: 'POST',
        path: '/api/roachclaw/:collection',
        examplePath: '/api/roachclaw/tasks',
        title: 'Create or update an item',
        summary: 'Send an `id` to update, leave it out to create.',
        handler: 'NativeRuntime.roachClawUpsertCollectionItem',
        source: 'Router.swift:370 (RoachClawStores.swift:38)',
        body: { title: 'Renew passport', status: 'open' },
        request: ['JSON body: the item. Same sixteen collections as the list route.'],
        response: ['The whole store, with the new item first.'],
        implementation:
          'New ids look like `task_<hex>`. Fields merge into the existing item and are trimmed per store (a contact name stops at 120 characters, for example). Webhook records get a `/api/roachclaw/hooks/:id` path, but 1.1 has no route behind it yet.',
      },
      {
        id: 'roachclaw-store-delete',
        method: 'DELETE',
        path: '/api/roachclaw/:collection/:id',
        examplePath: '/api/roachclaw/tasks/task_0123456789abcdef',
        title: 'Delete an item',
        summary: 'Removes one item from a store.',
        handler: 'NativeRuntime.deleteRoachClawCollectionItem',
        source: 'Router.swift:354',
        request: ['Path: the collection and the item `id`.'],
        response: ['`{ success, ok, deleted, id, state }`. `deleted` is false if nothing matched.'],
        implementation: 'No soft delete. Take a backup first if you might want the item back.',
      },
      {
        id: 'roachclaw-mail',
        method: 'GET',
        path: '/api/roachclaw/mail',
        title: 'Mail store',
        summary: 'Local mail records: accounts, messages and drafts.',
        handler: 'NativeRuntime.roachClawMailState',
        source: 'Router.swift:266',
        request: ['None.'],
        response: ['`{ schema, updatedAt, accounts, messages, drafts }`'],
        implementation: 'Records only. Nothing here sends or fetches mail.',
      },
      {
        id: 'roachclaw-mail-message',
        method: 'POST',
        path: '/api/roachclaw/mail/messages',
        title: 'Save a message',
        summary: 'Adds or updates one message record.',
        handler: 'NativeRuntime.upsertRoachClawMailMessage',
        source: 'Router.swift:267',
        body: { from: 'field@example.com', subject: 'Supply list', preview: 'Water, batteries, the good tape.' },
        request: ['JSON body: `id`, `account`, `folder`, `from`, `to`, `subject`, `preview` (or `body`), `tags`, `read`, `receivedAt`.'],
        response: ['The whole mail store.'],
        implementation: 'Defaults: account `local`, folder `Inbox`. Previews stop at 1,200 characters.',
      },
      {
        id: 'roachclaw-mail-draft',
        method: 'POST',
        path: '/api/roachclaw/mail/drafts',
        title: 'Save a draft',
        summary: 'Adds or updates one draft.',
        handler: 'NativeRuntime.upsertRoachClawMailDraft',
        source: 'Router.swift:268',
        body: { to: ['field@example.com'], subject: 'Re: Supply list', body: 'Adding matches.' },
        request: ['JSON body: `id`, `account`, `to`, `cc`, `subject`, `body`, `status`, `tags`.'],
        response: ['The whole mail store.'],
        implementation: 'Bodies stop at 8,000 characters. Saving a draft does not send it.',
      },
      {
        id: 'roachclaw-mail-message-delete',
        method: 'DELETE',
        path: '/api/roachclaw/mail/messages/:id',
        examplePath: '/api/roachclaw/mail/messages/message_0123456789abcdef',
        title: 'Delete a message',
        summary: 'Removes one message record.',
        handler: 'NativeRuntime.deleteRoachClawMailItem',
        source: 'Router.swift:357',
        request: ['Path: the message `id`.'],
        response: ['`{ success, ok, deleted, id, state }`'],
        implementation: 'Local record only.',
      },
      {
        id: 'roachclaw-mail-draft-delete',
        method: 'DELETE',
        path: '/api/roachclaw/mail/drafts/:id',
        examplePath: '/api/roachclaw/mail/drafts/draft_0123456789abcdef',
        title: 'Delete a draft',
        summary: 'Removes one draft.',
        handler: 'NativeRuntime.deleteRoachClawMailItem',
        source: 'Router.swift:358',
        request: ['Path: the draft `id`.'],
        response: ['`{ success, ok, deleted, id, state }`'],
        implementation: 'Local record only.',
      },
      {
        id: 'roachclaw-cookbook-schedules',
        method: 'GET',
        path: '/api/roachclaw/cookbook/schedules',
        title: 'Model serve schedules',
        summary: 'Saved windows for serving a model, with what is active now.',
        handler: 'NativeRuntime.roachClawCookbookServeState',
        source: 'Router.swift:162',
        request: ['None.'],
        response: ['`schedules` (each with `active` and `expired` worked out), plus `active`, `pending` and `expired` counts.'],
        implementation: 'Scheduler state only; the runtime does not start or stop a model from it.',
      },
      {
        id: 'roachclaw-cookbook-schedules-save',
        method: 'POST',
        path: '/api/roachclaw/cookbook/schedules',
        title: 'Save a serve schedule',
        summary: 'Adds or updates one schedule.',
        handler: 'NativeRuntime.upsertRoachClawCookbookServeSchedule',
        source: 'Router.swift:163',
        body: { model: 'qwen2.5-coder:7b', durationMinutes: 90 },
        request: ['JSON body: `id`, `model`, `repoId`, `days`, `startTime`, `endTime`, `durationMinutes` (1 to 1,440, default 60), `mirrorToCalendar`.'],
        response: ['The schedule list.'],
        implementation: 'Without `scheduledStopAtMs`, the stop time is now plus the duration.',
      },
      {
        id: 'roachclaw-cookbook-schedules-delete',
        method: 'DELETE',
        path: '/api/roachclaw/cookbook/schedules/:id',
        examplePath: '/api/roachclaw/cookbook/schedules/serve_0123456789ab',
        title: 'Delete a serve schedule',
        summary: 'Removes one schedule.',
        handler: 'NativeRuntime.deleteRoachClawCollectionItem',
        source: 'Router.swift:351',
        request: ['Path: the schedule `id`.'],
        response: ['`{ success, ok, deleted, id, state }`'],
        implementation: 'Schedules never start a model, so deleting one stops nothing.',
      },
      {
        id: 'roachclaw-cookbook-progress',
        method: 'POST',
        path: '/api/roachclaw/cookbook/progress-signal',
        title: 'Progress signal',
        summary: 'Turns download output into a comparable signal string.',
        handler: 'NativeRuntime.computeRoachClawCookbookProgressSignal',
        source: 'Router.swift:164',
        body: { lastPercent: 42, snapshot: 'pulling manifest… 42%' },
        request: ['JSON body: `bytes`, or `downloadAggregate` / `lastPercent` plus `snapshot`.'],
        response: ['`{ schema, signal, mode }`: `bytes:<n>` when bytes are given, otherwise the percent and the last 300 characters of the snapshot.'],
        implementation: 'Pure function. Stores nothing. Callers compare signals to tell a stalled download from a slow one.',
      },
      {
        id: 'roachclaw-backups',
        method: 'GET',
        path: '/api/roachclaw/backups',
        title: 'Backup snapshots',
        summary: 'The list of snapshots you have taken.',
        handler: 'NativeRuntime.roachClawBackupsState',
        source: 'Router.swift:282',
        request: ['None.'],
        response: ['`snapshots`: `id`, `title`, `summary`, `sections`, `createdAt`.'],
        implementation: 'Metadata only. See POST /api/roachclaw/backups for where the data goes.',
      },
      {
        id: 'roachclaw-backups-create',
        method: 'POST',
        path: '/api/roachclaw/backups',
        title: 'Take a backup',
        summary: 'Builds a full export, records a snapshot, and hands you the export.',
        handler: 'NativeRuntime.createRoachClawBackup',
        source: 'Router.swift:283',
        body: { title: 'Before cleanup' },
        request: ['JSON body: optional `title`.'],
        response: ['`{ success, ok, export, snapshots }`'],
        implementation:
          'The export is in the response and nowhere else: the runtime records the snapshot entry but does not write the export to disk. Save the reply if you want the backup.',
      },
      {
        id: 'roachclaw-backups-delete',
        method: 'DELETE',
        path: '/api/roachclaw/backups/:id',
        examplePath: '/api/roachclaw/backups/snapshot_0123456789abcdef',
        title: 'Delete a snapshot record',
        summary: 'Removes one snapshot entry.',
        handler: 'NativeRuntime.deleteRoachClawCollectionItem',
        source: 'Router.swift:361',
        request: ['Path: the snapshot `id`.'],
        response: ['`{ success, ok, deleted, id, state }`'],
        implementation: 'Only the record is removed. Exports you saved yourself are untouched.',
      },
      {
        id: 'roachclaw-export',
        method: 'GET',
        path: '/api/roachclaw/export',
        title: 'Export everything',
        summary: 'Every RoachClaw store and setting in one JSON document.',
        handler: 'NativeRuntime.roachClawExportPayload',
        source: 'Router.swift:284 (RoachClawStores.swift:1598)',
        request: ['None.'],
        response: ['`org.roachnet.roachclaw.export.v1`: contacts, tasks, calendar, mail, memories, skills, presets, tokens, providers, policies and the rest.'],
        implementation:
          'Secrets stay out: token hashes are stripped, provider keys never appear, and signature images are replaced with a placeholder.',
      },
    ],
  },
  {
    id: 'content',
    label: 'Maps, library and speech',
    scope: 'runtime',
    summary: 'Catalogs and downloads for offline maps, ZIM libraries, Wikipedia, saved sites and RoachSpeech packs.',
    stack: 'RoachNet.app → loopback API → download queue → storage/maps, storage/zim, storage/RoachSpeech',
    callers: ['RoachNet.app (RoachNetCore/ManagedAppRuntime.swift)'],
    endpoints: [
      {
        id: 'maps-curated-collections',
        method: 'GET',
        path: '/api/maps/curated-collections',
        title: 'Map collections',
        summary: 'The offline map catalog, with what is already installed.',
        handler: 'NativeRuntime.mapCollections',
        source: 'Router.swift:213 (RoachClawStatus.swift:1053)',
        request: ['None.'],
        response: ['Array of `{ slug, name, description, installed_count, total_count, resources }`. Each resource has a `url` and a `descriptorUrl` on apps.roachnet.org.'],
        implementation: 'Read from the bundled `collections/maps.json`. Installed counts come from `storage/maps/pmtiles`.',
      },
      {
        id: 'maps-download-base-assets',
        method: 'POST',
        path: '/api/maps/download-base-assets',
        title: 'Prepare map folders',
        summary: 'Creates the map folders. Despite the name, nothing downloads.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:216',
        request: ['No body needed.'],
        response: ['`{ success: true, ok: true, message: "Base atlas folders are ready." }`'],
        implementation: 'Creates `storage/maps/pmtiles` and `storage/maps/basemaps-assets`.',
      },
      {
        id: 'maps-download-collection',
        method: 'POST',
        path: '/api/maps/download-collection',
        title: 'Download a map collection',
        summary: 'Queues every map in one collection.',
        handler: 'NativeRuntime.queueResources',
        source: 'Router.swift:222',
        body: { slug: 'REPLACE-WITH-A-SLUG' },
        request: ['JSON body: `slug` from /api/maps/curated-collections.'],
        response: ['`{ success, ok, message: "<n> map downloads queued." }`'],
        implementation: 'An unknown slug queues zero downloads and says so, with a 200.',
      },
      {
        id: 'maps-download-remote',
        method: 'POST',
        path: '/api/maps/download-remote',
        title: 'Download a map by URL',
        summary: 'Queues one PMTiles file, or resolves a download descriptor first.',
        handler: 'NativeRuntime.queueResolvedDownload',
        source: 'Router.swift:226 (Downloads.swift:120)',
        body: { url: 'https://example.com/region.pmtiles' },
        request: ['JSON body: `url` (HTTP or HTTPS).'],
        response: ['`{ success, ok, message }`. `success: false` without a usable URL.'],
        implementation:
          'A URL ending in `.json` is read as a download descriptor: the runtime picks a usable source and checks the SHA-256 the descriptor names.',
      },
      {
        id: 'zim-curated-categories',
        method: 'GET',
        path: '/api/zim/curated-categories',
        title: 'Library categories',
        summary: 'The offline library catalog by category and tier.',
        handler: 'NativeRuntime.educationCategories',
        source: 'Router.swift:230 (RoachClawStatus.swift:1083)',
        request: ['None.'],
        response: ['Categories with `tiers`, each tier with `resources`, plus `installedTierSlug`.'],
        implementation: 'Read from the bundled `collections/kiwix-categories.json`; installed state comes from `storage/zim`.',
      },
      {
        id: 'zim-download-category-tier',
        method: 'POST',
        path: '/api/zim/download-category-tier',
        title: 'Download a library tier',
        summary: 'Queues every ZIM file in one tier of one category.',
        handler: 'NativeRuntime.queueResources',
        source: 'Router.swift:236',
        body: { categorySlug: 'REPLACE-ME', tierSlug: 'REPLACE-ME' },
        request: ['JSON body: `categorySlug`, `tierSlug`.'],
        response: ['`{ success, ok, message: "<n> knowledge downloads queued." }`'],
        implementation: 'Files land in `storage/zim`.',
      },
      {
        id: 'zim-download-category-resource',
        method: 'POST',
        path: '/api/zim/download-category-resource',
        title: 'Download one library item',
        summary: 'Queues a single resource from a category.',
        handler: 'NativeRuntime.queueResources',
        source: 'Router.swift:240',
        body: { categorySlug: 'REPLACE-ME', resourceId: 'REPLACE-ME' },
        request: ['JSON body: `categorySlug`, `resourceId`.'],
        response: ['`{ success, ok, message }`'],
        implementation: 'Searches every tier in the category for that resource id.',
      },
      {
        id: 'zim-download-remote',
        method: 'POST',
        path: '/api/zim/download-remote',
        title: 'Download a ZIM by URL',
        summary: 'Queues one ZIM file, or resolves a descriptor first.',
        handler: 'NativeRuntime.queueResolvedDownload',
        source: 'Router.swift:244',
        body: { url: 'https://example.com/library.zim' },
        request: ['JSON body: `url`.'],
        response: ['`{ success, ok, message }`'],
        implementation: 'Same descriptor and checksum rules as /api/maps/download-remote.',
      },
      {
        id: 'zim-wikipedia',
        method: 'GET',
        path: '/api/zim/wikipedia',
        title: 'Wikipedia options',
        summary: 'Which Wikipedia builds you can install, and which you picked.',
        handler: 'NativeRuntime.wikipediaState',
        source: 'Router.swift:233 (RoachClawStatus.swift:1131)',
        request: ['None.'],
        response: ['`{ options, currentSelection }`'],
        implementation: 'The selection lives in `storage/zim/wikipedia-selection.json`.',
      },
      {
        id: 'zim-wikipedia-select',
        method: 'POST',
        path: '/api/zim/wikipedia/select',
        title: 'Pick a Wikipedia build',
        summary: 'Records your choice and queues the download.',
        handler: 'NativeRuntime.selectWikipediaOption',
        source: 'Router.swift:248 (Downloads.swift:671)',
        body: { optionId: 'none' },
        request: ['JSON body: `optionId` from /api/zim/wikipedia.'],
        response: ['`{ success, ok, message }`'],
        implementation: '`none`, or an id that is not in the list, records a skip and downloads nothing.',
      },
      {
        id: 'site-archives-list',
        method: 'GET',
        path: '/api/site-archives',
        title: 'Saved sites',
        summary: 'Lists the sites you have archived.',
        handler: 'NativeRuntime.siteArchives',
        source: 'Router.swift:285 (RoachClawStatus.swift:1148)',
        request: ['None.'],
        response: ['`{ archives: [{ slug, title, url, createdAt }] }`'],
        implementation: 'Reads `storage/site-archives/index.json`. Read-only: 1.1 has no create or delete route here.',
      },
      {
        id: 'rag-files',
        method: 'GET',
        path: '/api/rag/files',
        title: 'Vault files',
        summary: 'Up to 80 file paths from your vault.',
        handler: 'NativeRuntime.listVaultKnowledgeFiles',
        source: 'Router.swift:209 (RoachClawStatus.swift:1000)',
        request: ['None.'],
        response: ['`{ files: [...] }`: relative paths under `storage/Vault`.'],
        implementation: 'A listing, not a search index. The `roachtail` and `roachclaw` folders are skipped.',
      },
      {
        id: 'roachspeech-model-packs-list',
        method: 'GET',
        path: '/api/roachspeech/model-packs',
        title: 'RoachSpeech packs',
        summary: 'Installed voice and speech packs, and any in flight.',
        handler: 'NativeRuntime.roachSpeechModelPacksState',
        source: 'Router.swift:265 (Downloads.swift:543)',
        request: ['None.'],
        response: ['`modelPacksRoot`, `packs` (with each manifest), `registry` of queued, installed and failed packs.'],
        implementation: 'Packs live in `storage/RoachSpeech/ModelPacks/<packID>`.',
      },
      {
        id: 'roachspeech-model-packs-download',
        method: 'POST',
        path: '/api/roachspeech/model-packs/download',
        title: 'Install a RoachSpeech pack',
        summary: 'Downloads, checks and unpacks one pack.',
        handler: 'NativeRuntime.queueRoachSpeechPackDownload',
        source: 'Router.swift:253 (Downloads.swift:476)',
        body: { packID: 'REPLACE-ME', kind: 'roachVoice', url: 'https://example.com/pack.zip' },
        request: ['JSON body: `packID`, `kind` (default `roachVoice`), `url`.'],
        response: ['`{ success, ok, message, packID, kind, jobId }`'],
        implementation:
          'When the archive lands it is unpacked with `ditto`. Its `RoachSpeechPack.json` must name the same pack and kind and declare a Core ML pack with no packaged binary; only then is it swapped into place. A failed install puts the previous pack back.',
      },
      {
        id: 'collections',
        method: 'GET',
        path: '/api/collections',
        title: 'Live collections',
        summary: 'New in 1.1. The map, Kiwix and Wikipedia lists this Mac is using, and where they came from.',
        handler: 'NativeRuntime.collectionsStatus',
        source: 'Router.swift:210',
        request: ['Query, optional: `refresh=1` fetches from apps.roachnet.org now instead of waiting for the six-hour refresh.'],
        response: ['`collections`: `id`, `source` (`live` or `bundled`), `url`, `fetchedAt`, `specVersion` for each list.'],
        implementation: 'Live lists are fetched over HTTPS only, capped at 4 MB, schema-checked and cached readable by you only. Offline, the bundled lists are used.',
        usedBy: ['Maps and library installers'],
      },
    ],
  },
  {
    id: 'downloads',
    label: 'Downloads and jobs',
    scope: 'runtime',
    summary: 'The download queue every install shares, plus the benchmark stub.',
    stack: 'Loopback API → NativeRuntime download queue (in memory)',
    callers: ['RoachNet.app (RoachNetCore/ManagedAppRuntime.swift)'],
    endpoints: [
      {
        id: 'downloads-jobs',
        method: 'GET',
        path: '/api/downloads/jobs',
        title: 'Download jobs',
        summary: 'Everything queued, running, finished or failed.',
        handler: 'NativeRuntime.downloadJobsSnapshot',
        source: 'Router.swift:318',
        request: ['None.'],
        response: ['Array of jobs: `jobId`, `url`, `filetype`, `status` (`queued`, `downloading`, `completed`, `failed`, `cancelled`), `progress`, `bytesReceived`, `totalBytes`, `filepath`, `failedReason`.'],
        implementation: 'In memory, newest 200. The list empties when the runtime restarts; the files do not.',
      },
      {
        id: 'downloads-remove-job',
        method: 'DELETE',
        path: '/api/downloads/jobs/:jobId',
        examplePath: '/api/downloads/jobs/JOB_ID',
        title: 'Cancel or clear a job',
        summary: 'Stops an active download, or drops a finished one from the list.',
        handler: 'NativeRuntime.cancelDownloadJob',
        source: 'Router.swift:362 (Downloads.swift:326)',
        request: ['Path: the `jobId`.'],
        response: ['`{ success: true, ok: true, cancelled }`. `cancelled` is false for an unknown id.'],
        implementation: 'An active transfer is stopped and its `.part` file deleted. A finished file stays on disk.',
      },
      {
        id: 'benchmark-status',
        method: 'GET',
        path: '/api/benchmark/status',
        title: 'Benchmark status',
        summary: '`idle`, almost always.',
        handler: 'NativeRuntime.benchmarkStatus',
        source: 'Router.swift:319',
        request: ['None.'],
        response: ['`{ status, benchmarkId }`'],
        implementation: 'See POST /api/benchmark/run.',
      },
      {
        id: 'benchmark-run',
        method: 'POST',
        path: '/api/benchmark/run',
        title: 'Run a benchmark',
        summary: 'Returns a benchmark id. No benchmark runs in 1.1.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:320',
        body: { benchmark_type: 'system' },
        request: ['JSON body: optional `benchmark_type`.'],
        response: ['201 with `{ success, job_id, benchmark_id, message }`'],
        implementation: 'Status flips to `starting` and back to `idle` two seconds later. Nothing is measured.',
      },
    ],
  },
  {
    id: 'packs',
    label: 'Feature packs',
    scope: 'runtime',
    summary: 'New in 1.1. What is installed, what the catalog offers, and the switches for each pack.',
    stack: 'Loopback API → NativeRuntime (PackRegistry, PackInstaller) → storage/packs',
    callers: ['Settings › Packs in RoachNet.app', 'The sidebar, which mounts only the panes whose pack is on'],
    endpoints: [
      {
        id: 'packs-list',
        method: 'GET',
        path: '/api/packs',
        title: 'Packs',
        summary: 'Every capability pack, installed resource pack and catalog pack, with its state.',
        handler: 'PackRegistry.catalogJSON',
        source: 'Router.swift:133',
        request: ['Query, optional: `sizes=1` walks each pack’s data folders for byte counts (slow on big shelves); `refresh=1` re-reads the catalog from apps.roachnet.org.'],
        response: [
          '`appVersion`, `platform`, `packsRoot`, `sizesIncluded`, `jobs` (installs in flight).',
          '`packs`: `id`, `version`, `kind` (`capability`, `resource`, `theme`, `animation`, `background`), `name`, `summary`, `bundled`, `installed`, `enabled`, `installedVersion`, `capabilities`, `dataRoots`, compatibility and missing dependencies.',
        ],
        implementation: 'Capability packs are compiled into the app and only switch on or off. Resource and theme packs are files, checked by SHA-256 and size before they are swapped in.',
        usedBy: ['Settings › Packs', 'Sidebar pane mounting'],
      },
      {
        id: 'packs-one',
        method: 'GET',
        path: '/api/packs/:id',
        examplePath: '/api/packs/roachnet-retro-terminals',
        title: 'One pack',
        summary: 'The same record as in the list, with data-folder sizes.',
        handler: 'PackRegistry.recordJSON',
        source: 'Router.swift:137',
        request: ['Path: the pack id.'],
        response: ['The pack record. 404 if no pack has that id.'],
        implementation: 'Sizes are always walked here, so ask for one pack rather than `sizes=1` on the list when you need one number.',
      },
      {
        id: 'packs-install',
        method: 'POST',
        path: '/api/packs/install',
        title: 'Install a pack',
        summary: 'From the catalog by id, from a manifest, or from a package folder on this Mac.',
        handler: 'NativeRuntime.installPack',
        source: 'Router.swift:136',
        body: { id: 'roachnet-retro-terminals' },
        request: [
          'JSON body, one of: `id` (a catalog pack), `manifestUrl` (https only), `manifest` (an `org.roachnet.pack.v1` object), or `packagePath` (a folder holding `manifest.json` and its resources).',
        ],
        response: [
          '202 with `status: "queued"` and a `job` for downloads, or `status: "installed"` and the `pack` for a local package.',
          '409 when the pack needs a newer RoachNet or a missing dependency, 422 when a file fails its checksum.',
        ],
        implementation:
          'Downloads go through the runtime downloader, so they resume after a stall and show in Downloads. Files are staged beside the install folder and moved in only after every SHA-256 matches. RoachSpeech packs go to the speech shelf instead.',
        usedBy: ['Install buttons in Settings › Packs', 'The `pack` install links on apps.roachnet.org'],
      },
      {
        id: 'packs-affect',
        method: 'POST',
        path: '/api/packs/:id/:action',
        examplePath: '/api/packs/roachnet-retro-terminals/disable',
        title: 'Enable, disable or remove',
        summary: '`enable`, `disable` or `uninstall` one pack.',
        handler: 'NativeRuntime.affectPack',
        source: 'Router.swift:141',
        body: { retainData: true },
        request: [
          'Path: the pack id and `enable`, `disable` or `uninstall`.',
          '`uninstall` takes `retainData` (default `true`). `false` moves the pack’s data folders to `packs/retired/` instead of leaving them in place. Nothing is deleted outright.',
        ],
        response: ['`{ success, pack }` for enable and disable; the uninstall result for uninstall. 409 if another enabled pack depends on this one.'],
        implementation: 'Disabling a capability pack unmounts its panes and stops its background work at once; its data stays where it is.',
        usedBy: ['Toggles and Remove in Settings › Packs'],
      },
    ],
  },
  {
    id: 'org',
    label: 'RoachClaw Org',
    scope: 'runtime',
    summary: 'New in 1.1. The agent company that runs on your Mac: companies, agents, issues, approvals, budgets and routines.',
    stack: 'Loopback API → NativeRuntime.routeOrg → OrgService (Org/*.swift) → storage/org',
    callers: ['The Org pane in RoachNet.app', 'RoachNet iOS 0.2 and later, through the companion bridge', 'Agents, with their own `x-roachnet-org-key`'],
    endpoints: [
      {
        id: 'org-adapters',
        method: 'GET',
        path: '/api/org/adapters',
        title: 'Agents on this Mac',
        summary: 'Which coding-agent CLIs (Claude Code, Codex, Gemini CLI, OpenCode, Cursor CLI) are installed, and signed in how.',
        handler: 'OrgCLIDetector.detectAll',
        source: 'OrgRouter.swift:104',
        request: ['Optional `refresh=1`.'],
        response: ['`{ adapters: [{ type, label, provider, installed, path, version, signedIn, authMethod, plan, models, installHint, signInHint, … }] }`.'],
        implementation: 'Owner only. Detection uses each CLI’s own version and status commands.',
      },
      {
        id: 'org-adapter-test',
        method: 'POST',
        path: '/api/org/adapters/:kind/test',
        title: 'Try an agent',
        summary: 'Checks one CLI again and, with `probe: true`, asks it for a one-word reply.',
        handler: 'OrgCLIProbe.test',
        source: 'OrgRouter.swift:108',
        request: ['`kind` in the path (`claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `cursor_local`); body `probe`, optional `adapterConfig` (`model`, `command`).'],
        response: ['The adapter’s detection fields, and with `probe` a `test` object: `{ ok, reply, latencyMs, model, billing, usage, error }`.'],
        implementation: 'Owner only. The probe runs in an empty scratch folder with read-only access and stops after three minutes.',
      },
      {
        id: 'org-companies',
        method: 'GET',
        path: '/api/org/companies',
        title: 'Companies',
        summary: 'The companies you can see.',
        handler: 'OrgService.listCompanies',
        source: 'OrgRouter.swift:123',
        request: ['None. Without an Org key you are the owner.'],
        response: ['`companies`: `id`, `name`, `description`, `status`, `issuePrefix`.'],
        implementation: 'Agents and invited members send `x-roachnet-org-key` (`rnorg_…` or a run’s `rnrun_…`) and see only their company. Those requests skip the loopback API token; the Org key is the credential.',
      },
      {
        id: 'org-companies-create',
        method: 'POST',
        path: '/api/org/companies',
        title: 'Start a company',
        summary: 'Creates a company with its own issue prefix.',
        handler: 'OrgService.createCompany',
        source: 'OrgRouter.swift:124',
        body: { name: 'RoachWares Studio' },
        request: ['JSON body: `name`, optional `description`.'],
        response: ['201 with `company`.'],
        implementation: 'Issue identifiers come from the name (`ROAC-1`, `ROAC-2`, …).',
      },
      {
        id: 'org-dashboard',
        method: 'GET',
        path: '/api/org/companies/:cid/dashboard',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/dashboard',
        title: 'Dashboard',
        summary: 'Counts the desk shows at the top.',
        handler: 'OrgService.dashboard',
        source: 'OrgRouter.swift:141',
        request: ['Path: the company id.'],
        response: ['`company`, `issuesByStatus`, `agentsByStatus`, `pendingApprovals`, `runningRuns`, `monthSpendCents`, `companyBudgetCents`.'],
      },
      {
        id: 'org-chart',
        method: 'GET',
        path: '/api/org/companies/:cid/org-chart',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/org-chart',
        title: 'Org chart',
        summary: 'Who reports to whom.',
        handler: 'OrgService.orgChart',
        source: 'OrgRouter.swift:145',
        request: ['Path: the company id.'],
        response: ['`roots`: agents with `id`, `name`, `role`, `title`, `status` and their `reports`, recursively. Terminated agents are left out.'],
      },
      {
        id: 'org-agents',
        method: 'GET',
        path: '/api/org/companies/:cid/agents',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/agents',
        title: 'Agents',
        summary: 'Every agent with its settings and state.',
        handler: 'OrgService.listAgents',
        source: 'OrgRouter.swift:159',
        request: ['Path: the company id.'],
        response: ['`agents`: `id`, `name`, `role`, `title`, `status`, `errorReason`, `reportsTo`, `adapterType`, `budgetMonthlyCents`, `heartbeat`, `lastHeartbeatAt`, `activeRunCount`.'],
        implementation: 'Agents run on RoachInference through the `roachclaw_local` adapter unless you give one another adapter.',
      },
      {
        id: 'org-agents-create',
        method: 'POST',
        path: '/api/org/companies/:cid/agents',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/agents',
        title: 'Hire an agent',
        summary: 'Adds an agent. When an agent asks to hire, the request goes to your approvals.',
        handler: 'OrgService.createAgent',
        source: 'OrgRouter.swift:160',
        body: { name: 'Linus', title: 'Engineer' },
        request: ['JSON body: `name`, optional `title`, `role`, `reportsTo`, `budgetMonthlyCents`, adapter settings.'],
        response: ['201 with `agent`, and `approval` when the hire waits for the board.'],
        implementation: 'The first agent becomes the CEO; later ones report to the CEO unless you say otherwise.',
      },
      {
        id: 'org-agents-status',
        method: 'POST',
        path: '/api/org/companies/:cid/agents/:id/:action',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/agents/agent_0123456789abcdef0123/pause',
        title: 'Pause, resume or let go',
        summary: '`pause`, `resume` or `terminate` an agent.',
        handler: 'OrgService.setAgentStatus',
        source: 'OrgRouter.swift:163',
        request: ['Path: the agent id and the action.'],
        response: ['`agent`.'],
        implementation: '`resume` also clears an error, so it is the “Try again” for an agent whose last heartbeat failed. `terminate` cancels its runs and revokes its keys.',
      },
      {
        id: 'org-issues',
        method: 'GET',
        path: '/api/org/companies/:cid/issues',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/issues?status=todo,in_progress',
        title: 'Issues',
        summary: 'The company’s work, most urgent first.',
        handler: 'OrgService.listIssues',
        source: 'OrgRouter.swift:178',
        request: ['Query, optional: `status` (comma-separated), `assignee` (`me` or an agent), `projectId`, `parentId`, `labelId`, `q`, `limit` (default 200).'],
        response: ['`issues` (with `identifier`, `status`, `priority`, `assigneeAgentName`, `blockers`) and `total`.'],
      },
      {
        id: 'org-issues-create',
        method: 'POST',
        path: '/api/org/companies/:cid/issues',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/issues',
        title: 'File an issue',
        summary: 'Creates an issue; an assigned agent wakes up for it.',
        handler: 'OrgService.createIssue',
        source: 'OrgRouter.swift:179',
        body: { title: 'Write the 1.1 release notes', priority: 'high' },
        request: ['JSON body: `title`, optional `description`, `priority` (`critical`, `high`, `medium`, `low`), `status`, `assigneeAgentId`, `projectId`, `goalId`, `parentId`, `labelIds`.'],
        response: ['201 with `issue`.'],
        implementation: 'Unassigned issues start in `backlog`, assigned ones in `todo`.',
      },
      {
        id: 'org-issues-update',
        method: 'PATCH',
        path: '/api/org/companies/:cid/issues/:id',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/issues/ROAC-1',
        title: 'Change an issue',
        summary: 'Status, assignee, priority, title or description.',
        handler: 'OrgService.updateIssue',
        source: 'OrgRouter.swift:181',
        body: { status: 'in_review' },
        request: ['Path: the issue id or identifier. JSON body: any of `status`, `assigneeAgentId`, `priority`, `title`, `description`, `comment`.'],
        response: ['`issue`. 409 when `expectedStatusVersion` is stale or another run has it checked out.'],
      },
      {
        id: 'org-issues-comment',
        method: 'POST',
        path: '/api/org/companies/:cid/issues/:id/comments',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/issues/ROAC-1/comments',
        title: 'Comment on an issue',
        summary: 'Adds a comment the assignee reads at its next heartbeat.',
        handler: 'OrgService.addComment',
        source: 'OrgRouter.swift:183',
        body: { body: 'Looks good from the Mac.' },
        request: ['JSON body: `body`.'],
        response: ['201 with the comment.'],
      },
      {
        id: 'org-approvals',
        method: 'GET',
        path: '/api/org/companies/:cid/approvals',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/approvals',
        title: 'Approvals',
        summary: 'Hires, strategy and budget overrides waiting on the board.',
        handler: 'OrgService.listApprovals',
        source: 'OrgRouter.swift:193',
        request: ['Query, optional: `status`.'],
        response: ['`approvals`: `id`, `type`, `status`, `payload`, `decisionNote`, `createdAt`.'],
      },
      {
        id: 'org-approvals-decide',
        method: 'POST',
        path: '/api/org/companies/:cid/approvals/:id/:decision',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/approvals/apr_0123456789abcdef0123/approve',
        title: 'Decide an approval',
        summary: '`approve`, `reject`, `request-revision` or `cancel`.',
        handler: 'OrgService.decideApproval',
        source: 'OrgRouter.swift:196',
        body: { note: 'Fine for this month.' },
        request: ['JSON body, optional: `note`, which the requesting agent reads.'],
        response: ['`approval`.'],
        implementation: 'RoachNet iOS 0.3 asks for Face ID, Touch ID or the passcode before it sends one of these.',
      },
      {
        id: 'org-budgets',
        method: 'GET',
        path: '/api/org/companies/:cid/budgets',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/budgets',
        title: 'Budgets',
        summary: 'Budget policies with spend so far, and incidents.',
        handler: 'OrgService.listBudgets',
        source: 'OrgRouter.swift:199',
        request: ['None.'],
        response: ['`policies` (`scopeType`, `scopeId`, `amountCents`, `observedCents`, `warnPercent`, `hardStopEnabled`, `windowKind`) and `incidents`.'],
      },
      {
        id: 'org-budgets-save',
        method: 'POST',
        path: '/api/org/companies/:cid/budgets',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/budgets',
        title: 'Set a budget',
        summary: 'A monthly or lifetime limit for the company, one agent or one project. `PATCH /budgets/:id` changes one.',
        handler: 'OrgService.saveBudget',
        source: 'OrgRouter.swift:200',
        body: { scopeType: 'company', amountCents: 5000 },
        request: ['JSON body: `amountCents`, optional `scopeType` (`company`, `agent`, `project`), `scopeId`, `windowKind`, `warnPercent` (default 80), `hardStopEnabled` (default true).'],
        response: ['201 with `policy`.'],
        implementation: 'Agents cannot change budgets. At the hard stop, work in that scope pauses and a `budget_override_required` approval is filed. Local models cost nothing; budgets matter for paid providers.',
      },
      {
        id: 'org-routines',
        method: 'GET',
        path: '/api/org/companies/:cid/routines',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/routines',
        title: 'Routines',
        summary: 'Recurring work: what, for whom, and when.',
        handler: 'OrgService.listRoutines',
        source: 'OrgRouter.swift:220',
        request: ['None.'],
        response: ['`routines`: `title`, `assigneeAgentId`, `status`, `concurrencyPolicy`, `triggers` (`schedule` with `cronExpression`, `timezone`, `nextRunAt`; `webhook`; `api`).'],
      },
      {
        id: 'org-routines-save',
        method: 'POST',
        path: '/api/org/companies/:cid/routines',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/routines',
        title: 'Add a routine',
        summary: 'Each run files an issue for the assignee. `PATCH /routines/:id` changes or pauses one.',
        handler: 'OrgService.saveRoutine',
        source: 'OrgRouter.swift:221',
        body: { title: 'Morning issue triage', assigneeAgentId: 'agent_0123456789abcdef0123', triggers: [{ kind: 'schedule', cronExpression: '0 9 * * 1-5', timezone: 'America/New_York' }] },
        request: ['JSON body: `title`, `assigneeAgentId`, `triggers` (five-field cron in a time zone), optional `description`, `priority`, `status`, `concurrencyPolicy`.'],
        response: ['201 with `routine`; a webhook trigger’s signing secret comes back once, in `secrets`.'],
        implementation: 'With the default `coalesce_if_active`, a run that finds the last one still open folds into it.',
      },
      {
        id: 'org-routines-run',
        method: 'POST',
        path: '/api/org/companies/:cid/routines/:id/run',
        examplePath: '/api/org/companies/co_0123456789abcdef0123/routines/rtn_0123456789abcdef0123/run',
        title: 'Run a routine now',
        summary: 'Fires it outside its schedule.',
        handler: 'OrgService.runRoutineNow',
        source: 'OrgRouter.swift:223',
        request: ['JSON body, optional: `variables`.'],
        response: ['202 with `run` (`issue_created`, `coalesced` or `skipped`).'],
      },
    ],
  },
  {
    id: 'companion',
    label: 'Companion bridge',
    scope: 'companion',
    summary: 'What your phone sees: a token-gated proxy for /api/companion/* and nothing else.',
    stack: 'RoachNet iOS → RoachTail bridge (in-process, loopback) → token or peer check → NativeRuntime.route',
    callers: ['RoachNet iOS 0.2.0 over RoachTail', 'RoachNet.app RoachTail, RoachSync and account settings'],
    endpoints: [
      {
        id: 'companion-health',
        method: 'GET',
        path: '/health',
        title: 'Bridge health',
        summary: 'The one bridge path that needs no token.',
        handler: 'CompanionProxy.handle',
        source: 'RuntimeServer.swift:353',
        noAuth: true,
        request: ['None.'],
        response: ['`{ status: "ok", targetOrigin, tokenConfigured, inProcess: true }`'],
        implementation:
          'Bridge port only. Anything outside `/api/companion/` gets a 404 from the bridge, so a phone token cannot reach the rest of the API.',
      },
      {
        id: 'companion-bootstrap',
        method: 'GET',
        path: '/api/companion/bootstrap',
        title: 'Phone bootstrap',
        summary: 'Everything the phone’s first screen needs, in one call.',
        handler: 'NativeRuntime.companionBootstrapState',
        source: 'Router.swift:286 (RoachClawStatus.swift:931)',
        request: ['None.'],
        response: ['`appName`, `machineName`, `appsCatalogUrl`, `account`, `runtime`, `vault`.'],
        implementation: 'It embeds the full runtime snapshot, so it costs what /api/companion/runtime costs.',
      },
      {
        id: 'companion-runtime',
        method: 'GET',
        path: '/api/companion/runtime',
        title: 'Runtime snapshot',
        summary: 'The phone’s Runtime tab: system, models, services, downloads.',
        handler: 'NativeRuntime.companionRuntimeState',
        source: 'Router.swift:287 (RoachClawStatus.swift:943)',
        request: ['None.'],
        response: ['`system`, `providers`, `roachClaw`, `account`, `roachTail` (join code hidden), `roachSync`, `services`, `downloads`, `installedModels`, `issues`, `benchmark`.'],
        implementation: '`issues` explains, in words, why chat might not answer yet.',
      },
      {
        id: 'companion-vault',
        method: 'GET',
        path: '/api/companion/vault',
        title: 'Vault summary',
        summary: 'Where the vault is and what is in it.',
        handler: 'NativeRuntime.companionVaultState',
        source: 'Router.swift:288 (RoachClawStatus.swift:987)',
        request: ['None.'],
        response: ['`{ vaultPath, knowledgeFiles, roachBrain: [] }`'],
        implementation: 'File names only, up to 80. The phone does not get file contents from this route.',
      },
      {
        id: 'companion-account',
        method: 'GET',
        path: '/api/companion/account',
        title: 'Account link',
        summary: 'The account metadata this Mac holds.',
        handler: 'NativeRuntime.accountState',
        source: 'Router.swift:289 (RoachClawStatus.swift:861)',
        request: ['None.'],
        response: ['`linked`, `status` (`local-only` until linked), `email`, `displayName`, `settingsSyncEnabled`, `savedAppsSyncEnabled`, `hostedChatEnabled`.'],
        implementation: 'Metadata on the Mac. Signing in happens at accounts.roachnet.org, not here.',
        usedBy: ['RoachNet.app account settings', 'RoachNet iOS'],
      },
      {
        id: 'companion-account-affect',
        method: 'POST',
        path: '/api/companion/account/affect',
        title: 'Link or unlink the account',
        summary: 'Updates the account metadata on this Mac.',
        handler: 'NativeRuntime.affectCompanionAccount',
        source: 'Router.swift:316 (CompanionLanes.swift:161)',
        body: { action: 'link', email: 'you@example.com', displayName: 'You' },
        request: ['JSON body: `action` (`link`, `unlink`, `refresh`). For `link`: `email`, `displayName` and the three sync booleans.'],
        response: ['`{ success, message, state }`', '400 for any other action.'],
        implementation: '`unlink` resets to `local-only`. This call sends nothing to roachnet.org.',
        usedBy: ['RoachNet.app account settings', 'RoachNet iOS'],
      },
      {
        id: 'companion-roachtail',
        method: 'GET',
        path: '/api/companion/roachtail',
        title: 'RoachTail state',
        summary: 'Pairing, peers and routes for the private device lane.',
        handler: 'NativeRuntime.roachTailState',
        source: 'Router.swift:290 (RoachTail.swift:338)',
        request: ['None.'],
        response: ['`enabled`, `status` (`local-only`, `armed`, `relay-ready`, `connected`), `transportMode`, `peers`, `routes`, `joinCode`, `pairingPayload`, `controlPlane`.'],
        implementation:
          'With a peer token, `joinCode` and `pairingPayload` come back null. A join code lasts ten minutes and a fresh one is minted when it expires.',
        usedBy: ['RoachNet.app RoachTail settings', 'RoachNet iOS'],
      },
      {
        id: 'companion-roachtail-pair',
        method: 'POST',
        path: '/api/companion/roachtail/pair',
        title: 'Pair a device',
        summary: 'Trades a join code for a device token, so it needs no token itself.',
        handler: 'NativeRuntime.pairRoachTailPeer',
        source: 'Router.swift:293 (RoachTail.swift:489)',
        noAuth: true,
        body: { joinCode: 'ABCD-EF12-3456', peerName: 'iPhone', platform: 'iOS' },
        request: ['JSON body: `joinCode` (required), `peerName`, `platform`, optional `endpoint`, `tags`, `capabilities`.'],
        response: [
          '`token` and `peerId` (the fields shipped phones read), `peerToken`, `bridgeUrl`, `runtimeTunnelUrl`, `state`.',
          '409 if RoachTail is off. 401 for a wrong, expired or used code.',
        ],
        implementation:
          'Each device gets its own `rtp_` token and the Mac keeps only its hash. One pairing per code, and five wrong guesses retire the code.',
      },
      {
        id: 'companion-roachtail-affect',
        method: 'POST',
        path: '/api/companion/roachtail/affect',
        title: 'Change RoachTail',
        summary: 'Turn the lane on or off, refresh the code, manage peers.',
        handler: 'NativeRuntime.mutateRoachTailState',
        source: 'Router.swift:294 (RoachTail.swift:392)',
        body: { action: 'refresh-join-code' },
        request: ['JSON body: `action`: `enable`, `disable`, `refresh-join-code`, `clear-peers`, `set-relay-host` (with `relayHost`), `register-peer`, `remove-peer` (with `peerId`).'],
        response: ['`{ success, ok, message, state }`. `register-peer` also returns a one-time `token`.'],
        implementation:
          'A paired device may only call `remove-peer`, and only on itself; anything else is a 403. It can do that even while RoachTail is off.',
        usedBy: ['RoachNet.app RoachTail settings', 'RoachNet iOS (remove this device)'],
      },
      {
        id: 'companion-roachsync',
        method: 'GET',
        path: '/api/companion/roachsync',
        title: 'RoachSync state',
        summary: 'Sync settings for this Mac.',
        handler: 'NativeRuntime.roachSyncState',
        source: 'Router.swift:297 (RoachClawStatus.swift:884)',
        request: ['None.'],
        response: ['`enabled`, `status`, `folderPath` (defaults to storage), `peers`, `transportMode: "native-local"`.'],
        implementation: 'Off until you enable it.',
        usedBy: ['RoachNet.app RoachSync settings', 'RoachNet iOS'],
      },
      {
        id: 'companion-roachsync-affect',
        method: 'POST',
        path: '/api/companion/roachsync/affect',
        title: 'Change RoachSync',
        summary: 'Enable, disable, refresh, set the folder or clear peers.',
        handler: 'NativeRuntime.affectCompanionRoachSync',
        source: 'Router.swift:317 (CompanionLanes.swift:197)',
        body: { action: 'enable' },
        request: ['JSON body: `action`: `enable`, `disable`, `refresh`, `set-folder-path` (with an existing absolute `folderPath`), `clear-peers`.'],
        response: ['`{ success, message, state }`', '400 for a folder that does not exist on this Mac.'],
        implementation: '`~` in `folderPath` is expanded before the check.',
        usedBy: ['RoachNet.app RoachSync settings', 'RoachNet iOS'],
      },
      {
        id: 'companion-install',
        method: 'POST',
        path: '/api/companion/install',
        title: 'Queue an install',
        summary: 'The RoachNet Apps install lane, for the phone and the Mac.',
        handler: 'NativeRuntime.handleCompanionInstall',
        source: 'Router.swift:299 (Downloads.swift:598)',
        body: { action: 'roachclaw-model', model: 'qwen2.5-coder:1.5b' },
        request: [
          'JSON body: `action` (or `type`): `base-map-assets`, `map-collection` (`slug`), `education-tier` (`categorySlug`, `tierSlug`), `education-resource` (`categorySlug`, `resourceId`), `direct-download` (`url`, `filetype`), `wikipedia-option` (`optionId`), `roachclaw-model` (`model`), `roachspeech-pack` (`packID`, `kind`, `url`).',
        ],
        response: [
          '`{ success, ok, action, message, jobId, jobIds, queued }`',
          '400 for a missing or unknown action. 403 when a paired device names a private or loopback host.',
        ],
        implementation:
          'From a paired phone, `url`, `mirrorUrl` and `sourceUrl` go through the URL-safety check with private ranges blocked, so a phone cannot turn your Mac into a fetcher for your own network.',
      },
      {
        id: 'companion-sessions-index',
        method: 'GET',
        path: '/api/companion/chat/sessions',
        title: 'Chat sessions',
        summary: 'Your RoachClaw chats from the phone, newest first.',
        handler: 'NativeRuntime.companionChatSessions',
        source: 'Router.swift:312',
        request: ['None.'],
        response: ['Array of `{ id, title, model, timestamp }`.'],
        implementation: 'Stored in `companion-chat.json` in the RoachClaw state folder. The newest 200 sessions are kept.',
      },
      {
        id: 'companion-sessions-store',
        method: 'POST',
        path: '/api/companion/chat/sessions',
        title: 'New chat session',
        summary: 'Creates an empty session.',
        handler: 'NativeRuntime.createCompanionChatSession',
        source: 'Router.swift:313 (CompanionLanes.swift:76)',
        body: { title: 'Trip notes', model: 'qwen2.5-coder:1.5b' },
        request: ['JSON body: optional `title` (default “New Chat”) and `model`.'],
        response: ['201 with the new session, `messages: []`.'],
        implementation: 'You rarely need it: /api/companion/chat/send makes a session when it does not find one.',
      },
      {
        id: 'companion-sessions-show',
        method: 'GET',
        path: '/api/companion/chat/sessions/:id',
        examplePath: '/api/companion/chat/sessions/SESSION_ID',
        title: 'One chat session',
        summary: 'A session with its messages.',
        handler: 'NativeRuntime.companionChatSession',
        source: 'Router.swift:337 (CompanionLanes.swift:41)',
        request: ['Path: the session `id`.'],
        response: ['The session, `messages` included.', '404 `Session not found`.'],
        implementation: 'Full history; the 40-message window only applies to what is sent to the model.',
      },
      {
        id: 'companion-chat-send',
        method: 'POST',
        path: '/api/companion/chat/send',
        title: 'Send a chat message',
        summary: 'Records your message, asks the local model, records the reply.',
        handler: 'NativeRuntime.sendCompanionChatMessage',
        source: 'Router.swift:314 (CompanionLanes.swift:84)',
        body: { content: 'What is on my calendar tomorrow?', model: 'qwen2.5-coder:1.5b' },
        request: ['JSON body: `content` (required), `sessionId` (a new session if missing or unknown), `model`, up to four `images`, `visionSummary`.'],
        response: [
          '`{ session, userMessage, assistantMessage }`',
          '400 without content. 503 when no local model answers.',
        ],
        implementation:
          'Sends the last 40 messages to the local model and titles a new chat from its first line. The roachnet.org web chat relays through this route when you give it a paired device.',
        usedBy: ['RoachNet iOS RoachClaw tab', 'roachnet.org web chat relay'],
      },
      {
        id: 'companion-services-affect',
        method: 'POST',
        path: '/api/companion/services/affect',
        title: 'Control a service',
        summary: 'Start, stop or restart a service from the phone.',
        handler: 'NativeRuntime.affectCompanionService',
        source: 'Router.swift:315 (CompanionLanes.swift:140)',
        body: { serviceName: 'roachnet_ollama', action: 'restart' },
        request: ['JSON body: `serviceName` (or `service_name`) from /api/system/services, `action`: `start`, `stop` or `restart`.'],
        response: ['`{ ok, serviceName, action, result }`', '400 for a bad action, 404 for an unknown service.'],
        implementation: 'Only the model server’s start and restart actually do something. The rest are validated and acknowledged.',
      },
      {
        id: 'companion-catch-all',
        method: 'POST',
        path: '/api/companion/*',
        examplePath: '/api/companion/anything-else',
        title: 'Any other companion action',
        summary: 'Every other POST under /api/companion/ gets the same success reply.',
        handler: 'NativeRuntime.route',
        source: 'Router.swift:373',
        request: ['Any path under `/api/companion/` not listed above.'],
        response: ['`{ success: true, ok: true, message: "Native companion action recorded." }`'],
        implementation: 'Despite the wording, nothing is recorded. It keeps older phones from hitting a 404.',
      },
      {
        id: 'companion-theme',
        method: 'GET',
        path: '/api/companion/theme',
        title: 'Active theme',
        summary: 'New in 1.1. The Mac’s resolved theme, so the phone can wear it.',
        handler: 'NativeRuntime.companionTheme',
        source: 'Router.swift:298',
        request: ['None.'],
        response: ['`org.roachnet.active-theme.v1`: `id`, `name`, `mode`, `revision`, `palette` (every color token), background, type and shape. Signal dark until the Mac app writes one.'],
        implementation: 'RoachNet.app writes `storage/themes/active-theme.json` whenever the theme changes; this route only reads it.',
        usedBy: ['RoachNet iOS 0.3 (Connection › Appearance)'],
      },
    ],
  },
  {
    id: 'web',
    label: 'roachnet.org functions',
    scope: 'web',
    summary: 'The two server functions behind accounts.roachnet.org and RoachClaw on the web.',
    stack: 'Browser → Netlify function → Supabase Auth and tables (row-level security) → your paired Mac or RoachBrain Cloud',
    callers: ['accounts.roachnet.org', 'roachnet.org/roachclaw'],
    endpoints: [
      {
        id: 'account-register',
        method: 'POST',
        path: '/.netlify/functions/register-account',
        title: 'Create a website account',
        summary: 'Signs you up for the optional roachnet.org account.',
        handler: 'netlify/functions/register-account.mjs',
        source: 'register-account.mjs (roachnet-org repo)',
        curl: [
          "curl -s -X POST https://roachnet.org/.netlify/functions/register-account \\",
          "  -H 'origin: https://accounts.roachnet.org' \\",
          "  -H 'content-type: application/json' \\",
          `  -d '{"email":"you@example.com","password":"at-least-ten-characters","captchaToken":"TURNSTILE_TOKEN"}'`,
        ].join('\n'),
        request: [
          'Origin must be roachnet.org or accounts.roachnet.org, or you get a 403.',
          'JSON body (16 KB at most): `email`, `password` (10 to 72 characters), `displayName` (up to 60), `captchaToken` when Turnstile is on.',
          '`company` is a honeypot. Any value in it gets the request rejected.',
        ],
        response: [
          '`{ ok: true, requiresConfirmation, message, userId }`',
          '400 `captcha_required`, 403 `captcha_failed`, 413 over 16 KB. An address that already has an account gets the same answer as a new one. 429 when sent too fast or too often (5 tries per address in 15 minutes, 3 per email in an hour). 503 when the backend or rate limiter is down.',
        ],
        implementation:
          'Signs up through Supabase `/auth/v1/signup` with the public key. The confirmation email links back to accounts.roachnet.org. No admin API, no service-role key. Sign-ups are rate-limited.',
      },
      {
        id: 'roachclaw-web-chat',
        method: 'POST',
        path: '/.netlify/functions/roachclaw-chat',
        title: 'Web RoachClaw message',
        summary: 'One prompt from roachnet.org/roachclaw, answered by your Mac or by RoachBrain Cloud.',
        handler: 'netlify/functions/roachclaw-chat.mjs',
        source: 'roachclaw-chat.mjs (roachnet-org repo)',
        curl: [
          "curl -s -X POST https://roachnet.org/.netlify/functions/roachclaw-chat \\",
          '  -H "authorization: Bearer $SUPABASE_ACCESS_TOKEN" \\',
          "  -H 'content-type: application/json' \\",
          `  -d '{"message":"Hello from the web"}'`,
        ].join('\n'),
        request: [
          '`authorization: Bearer <Supabase access token>`.',
          'A browser Origin other than roachnet.org or accounts.roachnet.org gets a 403. Calls with no Origin header, like curl, still need the token.',
          'JSON body: `message` (required), `threadId`, `bridgeUrl`, `bridgeToken`, `bridgeLabel`.',
          '`bridgeUrl` must be on the deploy’s allow-list.',
        ],
        response: [
          '`{ ok, thread, userMessage, assistantMessage, provider, model }`',
          '400 for a bad `threadId` or bridge address. 401 without a valid session. 404 for a thread that is not yours. 413 over 64 KB. 429 `rate_limited` after 20 messages in 10 minutes or 200 in a day. 503 when web chat is off, the limiter is down, or the model is still loading (`warming`; nothing is written, send it again). 500 if the reply fails.',
          '`GET ?health=runtime` answers without a token: whether this deploy can load the hosted model.',
        ],
        implementation:
          'Every lookup is scoped to your user id. With a bridge URL and token, the prompt goes to your Mac’s /api/companion/chat/send (ten-second timeout, redirects refused). Without one, RoachBrain Cloud answers: SmolLM2 135M (Apache-2.0, pinned to one Hugging Face commit), running on ONNX inside the function and downloaded into its /tmp on a cold start.',
      },
    ],
  },
]

/* --------------------------------------------------------------------------
   Renderer
   -------------------------------------------------------------------------- */

const methodOrder = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const groupNav = document.querySelector('#api-group-nav')
const statsMount = document.querySelector('#api-stats')
const groupSummary = document.querySelector('#api-group-summary')
const routeList = document.querySelector('#api-route-list')
const detailPane = document.querySelector('#api-detail-pane')
const detailBody = document.querySelector('#api-detail-body')
const detailClose = document.querySelector('#api-detail-close')
const detailScrim = document.querySelector('#api-detail-scrim')
const searchInput = document.querySelector('#api-search')
const methodFilter = document.querySelector('#api-method-filter')
const routeCount = document.querySelector('#api-route-count')
const viewTitle = document.querySelector('#api-view-title')
const notice = document.querySelector('#api-notice')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const sheetQuery = window.matchMedia('(max-width: 960px)')

const flattenedRoutes = apiGroups.flatMap((group) =>
  group.endpoints.map((endpoint) => ({
    ...endpoint,
    scope: group.scope,
    groupId: group.id,
    groupLabel: group.label,
    groupSummary: group.summary,
    groupStack: group.stack,
    groupCallers: group.callers,
    fullPath: endpoint.path,
  }))
)
const routeIndex = new Map(flattenedRoutes.map((route) => [route.id, route]))
const presentMethods = methodOrder.filter((method) => method === 'ALL' || flattenedRoutes.some((route) => route.method === method))

let activeGroup = 'all'
let activeMethod = 'ALL'
let activeRouteId = flattenedRoutes[0]?.id || null
let searchQuery = ''
let sheetOpen = false
let sheetReturnFocus = null

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Escapes, then turns `code` spans into <code>.
function rich(value) {
  return escapeHTML(value).replace(/`([^`]+)`/g, '<code>$1</code>')
}

// Let long paths wrap after a slash instead of mid-word on phones.
function pathBreaks(html) {
  return html.replace(/(?<!<)\//g, '/<wbr>')
}

function highlight(value) {
  const safe = escapeHTML(value)
  if (!searchQuery) return safe
  const needle = escapeHTML(searchQuery)
  const lower = safe.toLowerCase()
  let output = ''
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index !== -1 && needle) {
    output += `${safe.slice(cursor, index)}<mark>${safe.slice(index, index + needle.length)}</mark>`
    cursor = index + needle.length
    index = lower.indexOf(needle, cursor)
  }
  return output + safe.slice(cursor)
}

function shellQuote(text) {
  return `'${String(text).replaceAll("'", `'\\''`)}'`
}

function curlFor(route) {
  if (route.curl) return route.curl
  const surface = surfaces[route.scope]
  const path = route.examplePath || route.fullPath
  const url = `"${surface.base}${path}${route.query ? `?${route.query}` : ''}"`
  const lines = [route.method === 'GET' ? `curl -s ${url}` : `curl -s -X ${route.method} ${url}`]
  if (route.scope === 'companion' && !route.noAuth) lines.push('-H "authorization: Bearer $TOKEN"')
  if (route.body) {
    lines.push("-H 'content-type: application/json'")
    lines.push(`-d ${shellQuote(JSON.stringify(route.body))}`)
  }
  return lines.map((line, index) => (index === 0 ? line : `  ${line}`)).join(' \\\n')
}

function haystackFor(route) {
  return [
    route.groupLabel,
    route.title,
    route.summary,
    route.fullPath,
    route.handler,
    route.source,
    route.method,
    ...(route.usedBy || []),
    ...(route.request || []),
    ...(route.response || []),
    route.implementation,
  ]
    .join(' ')
    .toLowerCase()
}
const haystacks = new Map(flattenedRoutes.map((route) => [route.id, haystackFor(route)]))

function matches(route, { group = activeGroup, method = activeMethod, query = searchQuery } = {}) {
  if (group !== 'all' && route.groupId !== group) return false
  if (method !== 'ALL' && route.method !== method) return false
  if (query && !haystacks.get(route.id).includes(query)) return false
  return true
}

function getFilteredRoutes() {
  return flattenedRoutes.filter((route) => matches(route))
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function renderStats() {
  if (!statsMount) return
  const count = (method) => flattenedRoutes.filter((route) => route.method === method).length
  const items = [
    [flattenedRoutes.length, 'Routes in 1.1'],
    [count('GET'), 'GET'],
    [count('POST'), 'POST'],
    [count('PATCH') + count('DELETE'), 'PATCH + DELETE'],
  ]
  statsMount.innerHTML = items
    .map(([value, label]) => `<li class="nx-stat"><span class="nx-stat__value">${value}</span><span class="nx-stat__label">${escapeHTML(label)}</span></li>`)
    .join('')
}

function renderGroupNav() {
  const items = [
    { id: 'all', label: 'All routes', scope: '' },
    ...apiGroups.map((group) => ({ id: group.id, label: group.label, scope: group.scope })),
  ]
  groupNav.innerHTML = items
    .map((item) => {
      const visible = flattenedRoutes.filter((route) => matches(route, { group: item.id })).length
      const active = item.id === activeGroup
      return `
        <li>
          <button class="api-rail__item${active ? ' is-active' : ''}${visible ? '' : ' is-empty'}" data-group-id="${item.id}" type="button" aria-pressed="${active}">
            <span class="api-rail__label">${escapeHTML(item.label)}</span>
            <span class="api-rail__count" aria-label="${plural(visible, 'route')}">${visible}</span>
          </button>
        </li>`
    })
    .join('')
}

function renderMethodFilter() {
  methodFilter.innerHTML = presentMethods
    .map((method) => {
      const count = flattenedRoutes.filter((route) => matches(route, { method })).length
      const active = method === activeMethod
      return `
        <button class="api-chip api-chip--${method.toLowerCase()}${active ? ' is-active' : ''}" data-method="${method}" type="button" aria-pressed="${active}">
          <span>${method === 'ALL' ? 'All' : method}</span>
          <span class="api-chip__count">${count}</span>
        </button>`
    })
    .join('')
}

function renderSummary() {
  const group = apiGroups.find((item) => item.id === activeGroup) || null
  const filtered = getFilteredRoutes()
  const surface = group ? surfaces[group.scope] : null
  viewTitle.textContent = group ? group.label : searchQuery ? 'Search results' : 'All routes'
  routeCount.textContent = plural(filtered.length, 'route')

  groupSummary.innerHTML = group
    ? `
      <p class="api-summary__text">${rich(group.summary)}</p>
      <dl class="api-summary__meta">
        <div><dt>Server</dt><dd>${escapeHTML(surface.label)} · ${rich(surface.where)}</dd></div>
        <div><dt>Path</dt><dd>${escapeHTML(group.stack)}</dd></div>
      </dl>`
    : `<p class="api-summary__text">${
        searchQuery
          ? `Matching “${escapeHTML(searchQuery)}” across paths, handlers and notes.`
          : 'Four servers: the setup service, the loopback API, the companion bridge, and two functions on roachnet.org.'
      }</p>`
}

function renderRouteList() {
  const filtered = getFilteredRoutes()
  if (!filtered.length) {
    routeList.innerHTML = `
      <li class="api-empty">
        <p class="api-empty__title">Nothing answers to that.</p>
        <p class="api-empty__text">No 1.1 route matches${searchQuery ? ` “${escapeHTML(searchQuery)}”` : ''}${activeMethod !== 'ALL' ? ` with ${escapeHTML(activeMethod)}` : ''}${activeGroup !== 'all' ? ' in this group' : ''}.</p>
        <button class="nx-btn nx-btn--sm" type="button" data-api-reset>Clear filters</button>
      </li>`
    return
  }
  const grouped = activeGroup === 'all'
  let lastGroup = null
  routeList.classList.toggle('is-grouped', grouped)
  routeList.innerHTML = filtered
    .map((route) => {
      const active = route.id === activeRouteId
      let heading = ''
      if (grouped && route.groupId !== lastGroup) {
        lastGroup = route.groupId
        const count = filtered.filter((item) => item.groupId === route.groupId).length
        heading = `<li class="api-routes__group" aria-hidden="true"><span>${escapeHTML(route.groupLabel)}</span><span>${count}</span></li>`
      }
      return `${heading}
        <li>
          <button class="api-route${active ? ' is-active' : ''}" data-route-id="${route.id}" type="button" aria-pressed="${active}" aria-controls="api-detail-pane">
            <span class="api-method api-method--${route.method.toLowerCase()}">${route.method}</span>
            <span class="api-route__main">
              <span class="api-route__path">${pathBreaks(highlight(route.fullPath))}</span>
              <span class="api-route__title">${highlight(route.title)}</span>
            </span>
            <span class="api-route__group">${escapeHTML(route.groupLabel)}</span>
          </button>
        </li>`
    })
    .join('')
}

function list(items) {
  return `<ul>${(items || []).map((item) => `<li>${rich(item)}</li>`).join('')}</ul>`
}

function renderDetail({ animate = false } = {}) {
  const route = routeIndex.get(activeRouteId)
  if (!route || !getFilteredRoutes().includes(route)) {
    detailBody.innerHTML = `
      <div class="api-empty api-empty--detail">
        <p class="api-empty__title">Pick a route.</p>
        <p class="api-empty__text">Its request, response, source line and a curl you can paste land here.</p>
      </div>`
    return
  }
  const surface = surfaces[route.scope]
  const curl = curlFor(route)
  detailBody.innerHTML = `
    <header class="api-detail__head">
      <div class="api-detail__badges">
        <span class="api-method api-method--${route.method.toLowerCase()}">${route.method}</span>
        <span class="api-detail__group">${escapeHTML(route.groupLabel)}</span>
      </div>
      <h2 class="api-detail__title" id="api-detail-title" tabindex="-1">${escapeHTML(route.title)}</h2>
      <div class="api-detail__path">
        <code id="api-detail-path">${escapeHTML(route.fullPath)}</code>
        <button class="api-copy" type="button" data-api-copy="${escapeHTML(route.fullPath)}" data-api-copied="Path copied">Copy path</button>
      </div>
      <p class="api-detail__summary">${rich(route.summary)}</p>
    </header>
    <dl class="api-detail__facts">
      <div><dt>Server</dt><dd>${escapeHTML(surface.label)} · ${rich(surface.where)}</dd></div>
      <div><dt>Auth</dt><dd>${route.noAuth ? 'None. This route is open on purpose.' : rich(surface.auth)}</dd></div>
      <div><dt>Handler</dt><dd><code>${escapeHTML(route.handler)}</code></dd></div>
      <div><dt>Source</dt><dd><code>${escapeHTML(route.source)}</code></dd></div>
    </dl>
    <section class="api-detail__block" aria-labelledby="api-d-req"><h3 id="api-d-req">Request</h3>${list(route.request)}</section>
    <section class="api-detail__block" aria-labelledby="api-d-res"><h3 id="api-d-res">Response</h3>${list(route.response)}</section>
    <section class="api-detail__block" aria-labelledby="api-d-notes"><h3 id="api-d-notes">Notes</h3><p>${rich(route.implementation)}</p></section>
    <section class="api-detail__block" aria-labelledby="api-d-call"><h3 id="api-d-call">Called from</h3>${list(route.usedBy || route.groupCallers)}</section>
    <section class="api-detail__block api-detail__block--example" aria-labelledby="api-d-ex">
      <div class="api-detail__example-head">
        <h3 id="api-d-ex">Example</h3>
        ${route.scope === 'web' ? '' : `<a class="api-detail__vars" href="#before-you-call">Where ${escapeHTML(surfaces[route.scope].base)} comes from</a>`}
        <button class="api-copy" type="button" data-api-copy-target="#api-detail-curl" data-api-copied="curl copied">Copy curl</button>
      </div>
      <pre class="api-curl" tabindex="0" aria-label="Example curl command"><code id="api-detail-curl">${escapeHTML(curl)}</code></pre>
    </section>`
  detailPane.scrollTop = 0
  if (animate && !reducedMotion.matches) {
    detailBody.classList.remove('is-swapping')
    void detailBody.offsetWidth
    detailBody.classList.add('is-swapping')
  }
}

function syncSelection() {
  const filtered = getFilteredRoutes()
  if (!filtered.find((route) => route.id === activeRouteId)) {
    activeRouteId = filtered[0]?.id || null
  }
}

function renderAll() {
  renderGroupNav()
  renderMethodFilter()
  renderSummary()
  renderRouteList()
  renderDetail()
}

// After a filter shrinks the list, keep its top in view under the sticky toolbar
// instead of leaving the reader below an emptied page.
const toolbar = document.querySelector('.api-toolbar')
const workArea = document.querySelector('.api-work')
const listSection = document.querySelector('.api-list')
function keepListInView() {
  if (!toolbar || !workArea || !listSection) return
  const stickyTop = Number.parseFloat(getComputedStyle(toolbar).top) || 0
  const listTop = listSection.getBoundingClientRect().top
  if (listTop < stickyTop + toolbar.offsetHeight) {
    window.scrollTo({ top: window.scrollY + workArea.getBoundingClientRect().top - stickyTop, behavior: 'instant' })
  }
}

function applyFilters() {
  syncSelection()
  renderAll()
  keepListInView()
}

function updateHash() {
  if (!activeRouteId) return
  try {
    history.replaceState(null, '', `#${activeRouteId}`)
  } catch {
    // A sandboxed preview may refuse history writes; the page still works.
  }
}

function showNotice(text) {
  if (!notice) return
  notice.textContent = text
  notice.hidden = !text
}

function focusRoute(id) {
  const button = routeList.querySelector(`[data-route-id="${CSS.escape(id)}"]`)
  if (button) button.focus({ preventScroll: false })
}

function selectRoute(id, { fromKeyboard = false, openSheet = true } = {}) {
  if (!routeIndex.has(id)) return
  const changed = id !== activeRouteId
  activeRouteId = id
  routeList.querySelectorAll('[data-route-id]').forEach((button) => {
    const on = button.getAttribute('data-route-id') === id
    button.classList.toggle('is-active', on)
    button.setAttribute('aria-pressed', String(on))
  })
  renderDetail({ animate: changed })
  updateHash()
  showNotice('')
  if (sheetQuery.matches && openSheet) {
    openDetailSheet(routeList.querySelector(`[data-route-id="${CSS.escape(id)}"]`))
  } else if (fromKeyboard) {
    routeList.querySelector(`[data-route-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }
}

/* Phone sheet: the detail pane slides up over the list. */
function setInert(open) {
  detailPane.toggleAttribute('inert', sheetQuery.matches && !open)
}

function trapFocus(event) {
  if (!sheetOpen || event.key !== 'Tab') return
  const focusable = [...detailPane.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function openDetailSheet(returnTo) {
  if (!sheetQuery.matches) return
  sheetOpen = true
  sheetReturnFocus = returnTo || document.activeElement
  document.documentElement.classList.add('api-sheet-open')
  detailPane.classList.add('is-open')
  detailScrim.hidden = false
  detailPane.setAttribute('role', 'dialog')
  detailPane.setAttribute('aria-modal', 'true')
  detailPane.setAttribute('aria-labelledby', 'api-detail-title')
  setInert(true)
  requestAnimationFrame(() => detailPane.querySelector('#api-detail-title')?.focus({ preventScroll: true }))
}

function closeDetailSheet() {
  if (!sheetOpen) return
  sheetOpen = false
  document.documentElement.classList.remove('api-sheet-open')
  detailPane.classList.remove('is-open')
  detailScrim.hidden = true
  detailPane.removeAttribute('role')
  detailPane.removeAttribute('aria-modal')
  detailPane.removeAttribute('aria-labelledby')
  setInert(false)
  const target = sheetReturnFocus
  sheetReturnFocus = null
  if (target && document.contains(target)) target.focus({ preventScroll: true })
  else if (activeRouteId) focusRoute(activeRouteId)
}

function onLayoutChange() {
  if (!sheetQuery.matches && sheetOpen) closeDetailSheet()
  setInert(false)
}

/* Copy with a toast. nx.js binds static copy buttons at boot; these are rendered later. */
let toast
function showToast(message) {
  toast = toast || document.querySelector('.nx-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'nx-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.append(toast)
  }
  toast.textContent = message
  toast.classList.add('is-on')
  clearTimeout(toast._apiTimer)
  toast._apiTimer = setTimeout(() => toast.classList.remove('is-on'), 2200)
}

async function copyFrom(button) {
  const target = button.dataset.apiCopyTarget ? document.querySelector(button.dataset.apiCopyTarget) : null
  const text = target ? target.textContent : button.dataset.apiCopy
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    button.classList.add('is-done')
    setTimeout(() => button.classList.remove('is-done'), 1200)
    showToast(button.dataset.apiCopied || 'Copied to your clipboard')
  } catch {
    if (target) {
      const range = document.createRange()
      range.selectNodeContents(target)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
    showToast('Selected. Press ⌘C to copy')
  }
}

function resetFilters() {
  activeGroup = 'all'
  activeMethod = 'ALL'
  searchQuery = ''
  if (searchInput) searchInput.value = ''
  applyFilters()
}

function hydrateFromHash({ initial = false } = {}) {
  let id = ''
  try {
    id = decodeURIComponent(window.location.hash.replace(/^#/, '').trim())
  } catch {
    return
  }
  if (!id) return
  const route = routeIndex.get(id)
  if (!route) {
    if (/^[a-z0-9-]+$/.test(id) && !document.getElementById(id)) {
      showNotice(`No route called “${id}” in 1.1. It may have left with the Node runtime. Try the search above.`)
    }
    return
  }
  activeGroup = route.groupId
  activeMethod = 'ALL'
  searchQuery = ''
  if (searchInput) searchInput.value = ''
  activeRouteId = route.id
  syncSelection()
  renderAll()
  requestAnimationFrame(() => {
    const button = routeList.querySelector(`[data-route-id="${CSS.escape(route.id)}"]`)
    button?.scrollIntoView({ block: 'center', behavior: initial || reducedMotion.matches ? 'auto' : 'smooth' })
    if (sheetQuery.matches) openDetailSheet(button)
  })
}

/* Events */
groupNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group-id]')
  if (!button) return
  activeGroup = button.getAttribute('data-group-id') || 'all'
  applyFilters()
  updateHash()
})

methodFilter.addEventListener('click', (event) => {
  const button = event.target.closest('[data-method]')
  if (!button) return
  activeMethod = button.getAttribute('data-method') || 'ALL'
  applyFilters()
  updateHash()
})

routeList.addEventListener('click', (event) => {
  if (event.target.closest('[data-api-reset]')) {
    resetFilters()
    searchInput?.focus()
    return
  }
  const button = event.target.closest('[data-route-id]')
  if (button) selectRoute(button.getAttribute('data-route-id'))
})

routeList.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const buttons = [...routeList.querySelectorAll('[data-route-id]')]
  const index = buttons.indexOf(document.activeElement)
  if (index === -1) return
  event.preventDefault()
  const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]
  next.focus()
  if (!sheetQuery.matches) selectRoute(next.getAttribute('data-route-id'), { fromKeyboard: true })
})

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-api-copy], [data-api-copy-target]')
  if (button) copyFrom(button)
})

searchInput?.addEventListener('input', (event) => {
  searchQuery = String(event.currentTarget.value || '').trim().toLowerCase()
  applyFilters()
})

searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    if (searchInput.value) {
      searchInput.value = ''
      searchQuery = ''
      applyFilters()
    } else {
      searchInput.blur()
    }
  } else if (event.key === 'Enter') {
    const first = routeList.querySelector('[data-route-id]')
    if (first) {
      event.preventDefault()
      selectRoute(first.getAttribute('data-route-id'))
      if (!sheetQuery.matches) first.focus()
    }
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sheetOpen) {
    event.preventDefault()
    closeDetailSheet()
    return
  }
  trapFocus(event)
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  if (sheetOpen) closeDetailSheet()
  event.preventDefault()
  searchInput?.focus()
  searchInput?.select()
})

detailClose?.addEventListener('click', closeDetailSheet)
detailPane.addEventListener('click', (event) => {
  if (event.target.closest('.api-detail__vars') && sheetOpen) closeDetailSheet()
})
detailScrim?.addEventListener('click', closeDetailSheet)
sheetQuery.addEventListener('change', onLayoutChange)

window.addEventListener('hashchange', () => hydrateFromHash())

/* Boot */
renderStats()
syncSelection()
renderAll()
setInert(false)
hydrateFromHash({ initial: true })
document.documentElement.classList.add('api-ready')
