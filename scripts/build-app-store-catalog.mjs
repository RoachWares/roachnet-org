import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const paths = {
  maps: path.join(repoRoot, 'collections/maps.json'),
  kiwix: path.join(repoRoot, 'collections/kiwix-categories.json'),
  wikipedia: path.join(repoRoot, 'collections/wikipedia.json'),
  packs: path.join(repoRoot, 'collections/packs.json'),
  output: path.join(repoRoot, 'app-store-catalog.json'),
}

// Models the storefront lists that the native RoachInference engine cannot run
// yet (it loads llama, mistral, qwen2 and qwen3 GGUF architectures). They stay
// visible with the reason instead of a button that fails after a 10 GB pull.
const nativeUnsupportedModels = {
  'gemma3:4b': 'Gemma 3 is not supported by the native RoachInference engine yet.',
  'gemma3:12b': 'Gemma 3 is not supported by the native RoachInference engine yet.',
  'gpt-oss:20b': 'gpt-oss (MoE) is not supported by the native RoachInference engine yet.',
  'qwen3-coder:30b': 'Qwen3-Coder MoE is not supported by the native RoachInference engine yet.',
}

// The map files' public source (github.com/RoachWares/RoachNet-Maps) is gone
// and no mirror holds them; installs stay off until they are re-hosted.
const mapsAvailability = {
  state: 'unavailable',
  reason: 'Map files are being re-hosted. Installs come back as soon as the new mirror is live.',
}

function resourceIsAvailable(resource) {
  return !resource?.unavailable
}

const mapAccentCycle = ['blue', 'cyan', 'green', 'violet', 'gold', 'bronze']
const categoryAccents = {
  medicine: 'green',
  survival: 'gold',
  education: 'blue',
  'science-simulations': 'cyan',
  'kids-family': 'green',
  'open-courses': 'violet',
  'math-logic': 'violet',
  'law-history-society': 'bronze',
  'language-writing': 'blue',
  diy: 'bronze',
  'maker-electronics': 'gold',
  agriculture: 'green',
  'finance-crypto': 'gold',
  computing: 'violet',
  'machine-learning': 'cyan',
  'platforms-systems': 'bronze',
  'security-privacy': 'cyan',
  'music-audio': 'magenta',
  'design-visual-media': 'violet',
  'it-infrastructure': 'bronze',
  'travel-field-guides': 'blue',
  'travel-mobility-outdoors': 'cyan',
  'games-pop-culture': 'magenta',
  'homestead-sustainability': 'green',
  'dictionaries-primary-sources': 'violet',
}

const categoryBands = {
  medicine: 'MED',
  survival: 'FIELD',
  education: 'EDU',
  'science-simulations': 'SCI',
  'kids-family': 'KIDS',
  'open-courses': 'COURSE',
  'math-logic': 'SIGMA',
  'law-history-society': 'CIVIC',
  'language-writing': 'WORDS',
  diy: 'FIX',
  'maker-electronics': 'LAB',
  agriculture: 'GROW',
  'finance-crypto': 'FIN',
  computing: 'DEV',
  'machine-learning': 'ML',
  'platforms-systems': 'SYS',
  'security-privacy': 'SEC',
  'music-audio': 'AUDIO',
  'design-visual-media': 'VIS',
  'it-infrastructure': 'OPS',
  'travel-field-guides': 'TRVL',
  'travel-mobility-outdoors': 'ROAM',
  'games-pop-culture': 'PLAY',
  'homestead-sustainability': 'HEARTH',
  'dictionaries-primary-sources': 'LIB',
}

const artifactOrigin = {
  provider: 'Apps.RoachNet.org',
  engine: 'Static descriptors + open distribution sources',
  publicBaseUrl: 'https://apps.roachnet.org/downloads',
  storefrontUrl: 'https://apps.roachnet.org',
  mirrorPolicy: 'canonical-source-first',
  note:
    'Apps.RoachNet.org owns the catalog and same-origin install descriptors. Large archives stay on open public distribution lanes referenced by hash, not on a private machine or R2 bucket.',
}

const roachSpeechPackBaseUrl = `${artifactOrigin.publicBaseUrl}/model-packs`

const courseStatusMap = {
  essential: 'Great first install',
  standard: 'Recommended next install',
  comprehensive: 'Deep archive',
}

const wikipediaStatusMap = {
  'top-mini': 'Best first install',
  'top-nopic': 'Popular',
  'all-mini': 'Compact full library',
  'all-nopic': 'Deep archive',
  'all-maxi': 'Largest install',
}

const aiPacks = [
  {
    id: 'roachclaw-quickstart',
    title: 'RoachClaw Quickstart',
    subtitle: 'Contained qwen2.5-coder:1.5b model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '1.5 GB',
    status: 'Best first boot',
    source: 'Local model lane',
    summary:
      'Get RoachClaw talking quickly on a clean machine with the small contained coding model RoachNet already recommends for first boot.',
    accent: 'violet',
    machineFit: 'Best on all Apple Silicon Macs, especially 16 GB machines',
    includes: [
      'Contained Ollama-backed model download',
      'Fastest local coding lane for first launch',
      'Cloud lane can stay available while the model warms up',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5-coder:1.5b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q15',
  },
  {
    id: 'roachclaw-coder-compact',
    title: 'RoachClaw Coder Compact',
    subtitle: 'Contained qwen2.5-coder:3b fast lane',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.0 GB',
    status: 'Lean coding lane',
    source: 'Local model lane',
    summary:
      'A roomier coding lane than Quickstart without jumping straight to the heavier packs. Good when you want better local code help without tying up the whole machine.',
    accent: 'cyan',
    machineFit: 'Best on everyday Apple Silicon Macs that want a small but useful local coding lane',
    includes: [
      'Contained 3B coding model queue',
      'A cleaner step up from the first-boot model',
      'Still light enough for daily local work',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5-coder:3b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q3B',
  },
  {
    id: 'roachclaw-studio',
    title: 'RoachClaw Studio',
    subtitle: 'Contained qwen2.5-coder:7b upgrade',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.8 GB',
    status: 'For larger Apple Silicon Macs',
    source: 'Local model lane',
    summary:
      'Move up to the larger local coding lane for longer refactors, stronger reasoning, and more comfortable day-to-day coding assist.',
    accent: 'violet',
    machineFit: 'Best on M2 Pro, Max, and higher-memory Apple Silicon',
    includes: [
      'Contained 7B coding model queue',
      'RoachClaw workbench handoff in the native shell',
      'Better room for heavier coding and agent tasks',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5-coder:7b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q7B',
  },
  {
    id: 'roachclaw-generalist',
    title: 'RoachClaw Generalist',
    subtitle: 'Contained qwen2.5:7b everyday model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.7 GB',
    status: 'Balanced local lane',
    source: 'Local model lane',
    summary:
      'A broader local model for notes, drafting, planning, and general assistant work when you want something less coding-specific than the default lane.',
    accent: 'cyan',
    machineFit: 'Best on Macs with enough memory for a comfortable always-on local lane',
    includes: [
      'Contained general-purpose local model',
      'Works well for notes, drafts, summaries, and planning',
      'RoachNet still keeps the cloud lane optional',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5:7b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q7',
  },
  {
    id: 'roachclaw-pocket',
    title: 'RoachClaw Pocket',
    subtitle: 'Contained llama3.2:3b small general model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.0 GB',
    status: 'Fast everyday replies',
    source: 'Local model lane',
    summary:
      'A lighter general model for quick chat, short notes, and mobile-minded pairings when you want local answers without loading one of the larger shelves.',
    accent: 'green',
    machineFit: 'Best when you want a lighter general chat lane that wakes up fast',
    includes: [
      'Contained 3B general model queue',
      'Useful for quick replies and lighter note work',
      'Fits nicely beside the coding-first shelves',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'llama3.2:3b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'L3',
  },
  {
    id: 'roachclaw-analyst',
    title: 'RoachClaw Analyst',
    subtitle: 'Contained gemma3:4b research lane',
    category: 'Local AI',
    section: 'Model Packs',
    size: '3.3 GB',
    status: 'Balanced research lane',
    source: 'Local model lane',
    summary:
      'A practical middleweight model for reading, summarizing, and working through ideas when you want something broader than the coder packs but still reasonably light.',
    accent: 'blue',
    machineFit: 'Best on Apple Silicon Macs that need a balanced local reading and planning lane',
    includes: [
      'Contained 4B research model queue',
      'Strong for notes, summaries, and planning passes',
      'Good bridge between lightweight chat and heavier local reasoning',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'gemma3:4b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'G4',
  },
  {
    id: 'roachclaw-analyst-pro',
    title: 'RoachClaw Analyst Pro',
    subtitle: 'Contained gemma3:12b deep work lane',
    category: 'Local AI',
    section: 'Model Packs',
    size: '8.1 GB',
    status: 'Deep local analysis',
    source: 'Local model lane',
    summary:
      'A heavier local analyst shelf for longer reads, tighter summaries, and more patient reasoning when the small lanes start to feel cramped.',
    accent: 'magenta',
    machineFit: 'Best on higher-memory Apple Silicon when you want a serious local analysis lane',
    includes: [
      'Contained 12B analyst model queue',
      'More comfortable for longer reads and structured summaries',
      'Good second shelf after a smaller general model',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'gemma3:12b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'G12',
  },
  {
    id: 'roachclaw-coder-large',
    title: 'RoachClaw Coder Large',
    subtitle: 'Contained qwen2.5-coder:14b lane',
    category: 'Local AI',
    section: 'Model Packs',
    size: '9.0 GB',
    status: 'Heavy local install',
    source: 'Local model lane',
    summary:
      'A bigger local coding model for machines with real headroom and users who want the strongest local-first Dev Studio pairing RoachNet can comfortably stage.',
    accent: 'magenta',
    machineFit: 'Best on higher-memory Apple Silicon and Exo-assisted setups',
    includes: [
      'Contained 14B coding model queue',
      'Pairs well with Exo-enabled multi-machine routing',
      'Intended for serious local coding sessions',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5-coder:14b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q14',
  },
  {
    id: 'roachclaw-coder-ultra',
    title: 'RoachClaw Coder Ultra',
    subtitle: 'Contained qwen2.5-coder:32b heavyweight shelf',
    category: 'Local AI',
    section: 'Model Packs',
    size: '19 GB',
    status: 'Big machine only',
    source: 'Local model lane',
    summary:
      'The heavyweight local coding shelf for machines with real headroom. This is the one you queue when you want the strongest contained coding lane RoachNet can sensibly carry.',
    accent: 'violet',
    machineFit: 'Best on high-memory Apple Silicon or a RoachTail-connected multi-machine setup',
    includes: [
      'Contained 32B coding model queue',
      'Meant for serious local code work, not casual bootstraps',
      'Pairs best with machines that can actually feed it',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen2.5-coder:32b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q32',
  },
  {
    id: 'roachclaw-modern-generalist',
    title: 'RoachClaw Modern Generalist',
    subtitle: 'Contained qwen3:4b daily shelf',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.6 GB',
    status: 'Modern small lane',
    source: 'Local model lane',
    summary:
      'A newer small general lane for notes, summaries, and fast local answers when you want something sharper than the first-boot pack without waking the whole bunker.',
    accent: 'green',
    machineFit: 'Best on 16 GB Apple Silicon machines that need a quick everyday local model',
    includes: [
      'Contained Qwen3 4B model queue',
      'Good fit for vault notes, planning, and short RoachClaw replies',
      'Light enough to keep beside dev, music, and the rest of the shell',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen3:4b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q3',
  },
  {
    id: 'roachclaw-modern-balanced',
    title: 'RoachClaw Modern Balanced',
    subtitle: 'Contained qwen3:8b stronger daily shelf',
    category: 'Local AI',
    section: 'Model Packs',
    size: '5.2 GB',
    status: 'Better local thinking',
    source: 'Local model lane',
    summary:
      'A stronger modern general lane for users who want more patient local reasoning without jumping straight into workstation-only territory.',
    accent: 'cyan',
    machineFit: 'Best on M-series Macs with enough memory for a serious always-local assistant',
    includes: [
      'Contained Qwen3 8B model queue',
      'Good for docs, vault notes, planning, and mixed work',
      'Keeps the useful stuff local without pretending RAM is infinite',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen3:8b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q8',
  },
  {
    id: 'roachclaw-open-reasoner',
    title: 'RoachClaw Open Reasoner',
    subtitle: 'Contained gpt-oss:20b reasoning shelf',
    category: 'Local AI',
    section: 'Model Packs',
    size: '13 GB',
    status: 'Open-weight heavy lane',
    source: 'Local model lane',
    summary:
      'A heavier open-weight reasoning shelf for machines with headroom. It is not the first thing you install on a cramped Mac, but it earns its space when the work gets thorny.',
    accent: 'magenta',
    machineFit: 'Best on higher-memory Apple Silicon and RoachTail-assisted setups',
    includes: [
      'Contained GPT-OSS 20B model queue',
      'Useful for longer planning, analysis, and agent-style work',
      'Optional by design, because nobody needs a surprise 13 GB houseguest',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'gpt-oss:20b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'G20',
  },
  {
    id: 'roachclaw-modern-coder-heavy',
    title: 'RoachClaw Modern Coder Heavy',
    subtitle: 'Contained qwen3-coder:30b workstation shelf',
    category: 'Local AI',
    section: 'Model Packs',
    size: '19 GB',
    status: 'Big code shelf',
    source: 'Local model lane',
    summary:
      'A modern heavyweight coding shelf for long-context work and serious refactors. It is for Macs with headroom, not for pretending a tiny machine is a server rack.',
    accent: 'blue',
    machineFit: 'Best on high-memory Apple Silicon or RoachTail-assisted multi-machine setups',
    includes: [
      'Contained Qwen3 Coder 30B model queue',
      'Long-context coding and agent work',
      'Optional because big models should ask before moving in',
    ],
    installIntent: {
      action: 'roachclaw-model',
      model: 'qwen3-coder:30b',
    },
    iconBand: 'RoachClaw',
    iconMonogram: 'QC30',
  },  {
    id: 'roachclaw-tiny-scout',
    title: 'RoachClaw Tiny Scout',
    subtitle: 'Native qwen2.5:0.5b for instant replies',
    category: 'Local AI',
    section: 'Model Packs',
    size: '0.4 GB',
    status: 'Smallest native lane',
    source: 'Native RoachInference engine',
    summary:
      'The smallest model the native engine ships a digest for. Instant on any Apple Silicon Mac, good for quick rewrites, summaries and command help; not for deep reasoning.',
    accent: 'cyan',
    machineFit: 'Runs on every supported Mac, including 8 GB machines',
    includes: ['Native RoachInference pull with SHA-256 verification', 'Sub-second first token on M1 and later', 'A sensible fallback lane next to a bigger model'],
    installIntent: { action: 'roachclaw-model', model: 'qwen2.5:0.5b' },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q05',
  },
  {
    id: 'roachclaw-modern-tiny',
    title: 'RoachClaw Modern Tiny',
    subtitle: 'Native qwen3:0.6b thinking-capable micro model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '0.4 GB',
    status: 'Modern micro lane',
    source: 'Native RoachInference engine',
    summary:
      'Qwen3 at its smallest: a modern micro model with the newer chat template and optional thinking mode, for machines where every gigabyte counts.',
    accent: 'cyan',
    machineFit: 'Runs on every supported Mac',
    includes: ['Native RoachInference pull with SHA-256 verification', 'Qwen3 chat template and thinking toggle', 'Pairs well with RoachClaw Modern Generalist as the fast lane'],
    installIntent: { action: 'roachclaw-model', model: 'qwen3:0.6b' },
    iconBand: 'RoachClaw',
    iconMonogram: 'Q06',
  },
  {
    id: 'roachclaw-llama-balanced',
    title: 'RoachClaw Llama Balanced',
    subtitle: 'Native llama3.1:8b general assistant',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.9 GB',
    status: 'Balanced general lane',
    source: 'Native RoachInference engine',
    summary:
      'Meta’s Llama 3.1 8B as a dependable everyday assistant: writing, explanation, planning and tool-style replies with a long context window.',
    accent: 'violet',
    machineFit: 'Best on 16 GB Apple Silicon Macs and up',
    includes: ['Native RoachInference pull with SHA-256 verification', '128K context window', 'A good second opinion next to the Qwen coders'],
    installIntent: { action: 'roachclaw-model', model: 'llama3.1:8b' },
    iconBand: 'RoachClaw',
    iconMonogram: 'L31',
  },
  {
    id: 'roachclaw-mistral-classic',
    title: 'RoachClaw Mistral Classic',
    subtitle: 'Native mistral:7b instruct',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.4 GB',
    status: 'Classic 7B lane',
    source: 'Native RoachInference engine',
    summary:
      'Mistral 7B Instruct: a fast, well-understood 7B that stays coherent on long drafts and is light on memory for its size.',
    accent: 'violet',
    machineFit: 'Comfortable on 16 GB Apple Silicon Macs',
    includes: ['Native RoachInference pull with SHA-256 verification', 'Fast decode on the Metal backend', 'Good for drafting, rewriting and Q&A'],
    installIntent: { action: 'roachclaw-model', model: 'mistral:7b' },
    iconBand: 'RoachClaw',
    iconMonogram: 'M7B',
  },
  {
    id: 'roachclaw-smol-pocket',
    title: 'RoachClaw Smol Pocket',
    subtitle: 'Native smollm2:135m for on-device utilities',
    category: 'Local AI',
    section: 'Model Packs',
    size: '0.1 GB',
    status: 'Utility micro model',
    source: 'Native RoachInference engine',
    summary:
      'SmolLM2 135M is a utility model, not a chat partner: classification, short completions, and smoke tests of the native lane on the smallest machines.',
    accent: 'cyan',
    machineFit: 'Runs anywhere; useful for testing the native engine',
    includes: ['Native RoachInference pull with SHA-256 verification', 'Loads in under a second', 'Handy for automation steps that need a tiny model'],
    installIntent: { action: 'roachclaw-model', model: 'smollm2:135m' },
    iconBand: 'RoachClaw',
    iconMonogram: 'S13',
  },
  {
    id: 'roachclaw-smol-compact',
    title: 'RoachClaw Smol Compact',
    subtitle: 'Native smollm2:1.7b small assistant',
    category: 'Local AI',
    section: 'Model Packs',
    size: '1.1 GB',
    status: 'Small assistant lane',
    source: 'Native RoachInference engine',
    summary:
      'SmolLM2 1.7B: a small assistant that answers quickly and keeps memory low, for Macs that need RoachClaw responsive rather than exhaustive.',
    accent: 'cyan',
    machineFit: 'Runs on every supported Mac, including 8 GB machines',
    includes: ['Native RoachInference pull with SHA-256 verification', 'Low memory footprint', 'A step up from the micro models without a big download'],
    installIntent: { action: 'roachclaw-model', model: 'smollm2:1.7b' },
    iconBand: 'RoachClaw',
    iconMonogram: 'S17',
  },

]

const roachVoicePacks = [
  {
    id: 'roachvoice-cloner-forge',
    title: 'RoachVoice Cloner Forge',
    subtitle: 'Heavy local voice-cloning shelf',
    category: 'Voice AI',
    section: 'Voice Packs',
    size: '1.7 GB',
    status: 'Voice cloning',
    source: 'RoachSpeech Core ML pack',
    summary:
      'The full local cloning lane for RoachClaw: Chatterbox-derived Core ML speech, reference voices, and no Python service hiding in the wall.',
    accent: 'magenta',
    machineFit: 'Best on Apple Silicon Macs with comfortable storage and memory headroom',
    includes: [
      'RoachVoice Chatterbox Core ML components',
      'Local reference-voice cloning lane',
      'Optional install so the public baseline stays lean',
    ],
    installIntent: {
      action: 'roachspeech-pack',
      pack: 'roachvoice-chatterbox-coreml',
      kind: 'roachVoice',
      url: `${roachSpeechPackBaseUrl}/roachvoice-chatterbox-coreml.json`,
      checksumUrl: `${roachSpeechPackBaseUrl}/roachvoice-chatterbox-coreml.zip.sha256`,
      artifactKey: 'model-packs/roachvoice-chatterbox-coreml.zip',
      artifactProvider: artifactOrigin.provider,
    },
    artifact: mirrorArtifact('model-packs/roachvoice-chatterbox-coreml.zip', { checksum: true, status: 'published' }),
    iconBand: 'RoachVoice',
    iconMonogram: 'CBX',
    iconFamily: 'voice',
  },
  {
    id: 'roachvoice-small-narrator',
    title: 'RoachVoice Small Narrator',
    subtitle: 'Tiny native narration fallback',
    category: 'Voice AI',
    section: 'Voice Packs',
    size: '87 MB',
    status: 'Baseline voice',
    source: 'RoachSpeech Core ML pack',
    summary:
      'A small Kokoro-derived narrator pack for read-aloud and basic local speech when you do not need full cloning yet. Useful, boring, and hard to kill.',
    accent: 'green',
    machineFit: 'Good on every Apple Silicon Mac and bundled in the baseline desktop build',
    includes: [
      'Compact Core ML narrator model',
      'Local read-aloud voice table',
      'Falls back cleanly when the cloning shelf is too heavy',
    ],
    installIntent: {
      action: 'roachspeech-pack',
      pack: 'roachvoice-kokoro-82m-int8-coreml',
      kind: 'roachVoice',
      url: `${roachSpeechPackBaseUrl}/roachvoice-kokoro-82m-int8-coreml.json`,
      checksumUrl: `${roachSpeechPackBaseUrl}/roachvoice-kokoro-82m-int8-coreml.zip.sha256`,
      artifactKey: 'model-packs/roachvoice-kokoro-82m-int8-coreml.zip',
      artifactProvider: artifactOrigin.provider,
    },
    artifact: mirrorArtifact('model-packs/roachvoice-kokoro-82m-int8-coreml.zip', { checksum: true, status: 'published' }),
    iconBand: 'RoachVoice',
    iconMonogram: 'K82',
    iconFamily: 'voice',
  },
  {
    id: 'roachwhisper-listener',
    title: 'RoachWhisper Listener',
    subtitle: 'Local STT for transcripts and lyrics',
    category: 'Speech AI',
    section: 'Voice Packs',
    size: '144 MB',
    status: 'Baseline STT',
    source: 'RoachSpeech Core ML pack',
    summary:
      'The local listening shelf for RoachSpeech: speech-to-text, transcript sidecars, and lyric extraction for vault media without renting ears from a cloud.',
    accent: 'cyan',
    machineFit: 'Good on every Apple Silicon Mac and bundled in the baseline desktop build',
    includes: [
      'RoachWhisper Core ML encoder and decoder',
      'Transcript sidecars for vault audio and video',
      'Local STT fallback when the network is dead weight',
    ],
    installIntent: {
      action: 'roachspeech-pack',
      pack: 'roachwhisper-openai-whisper-base-en-coreml',
      kind: 'roachWhisper',
      url: `${roachSpeechPackBaseUrl}/roachwhisper-openai-whisper-base-en-coreml.json`,
      checksumUrl: `${roachSpeechPackBaseUrl}/roachwhisper-openai-whisper-base-en-coreml.zip.sha256`,
      artifactKey: 'model-packs/roachwhisper-openai-whisper-base-en-coreml.zip',
      artifactProvider: artifactOrigin.provider,
    },
    artifact: mirrorArtifact('model-packs/roachwhisper-openai-whisper-base-en-coreml.zip', { checksum: true, status: 'published' }),
    iconBand: 'RoachWhisper',
    iconMonogram: 'WSP',
    iconFamily: 'voice',
  },
]

const curatedMapPacks = [
  {
    id: 'map-global-mini',
    title: 'Global Mini Atlas',
    subtitle: 'Fast world fallback basemap',
    url: 'https://github.com/RoachWares/RoachNet-Maps/raw/refs/heads/master/pmtiles/global-min_2025-12.pmtiles',
    sizeBytes: 184137576,
    status: 'Travel-ready fallback',
    accent: 'cyan',
    machineFit: 'Best when you want one compact world map on every machine',
    summary:
      'A compact world basemap for quick travel checks, rough routing, and backup context when you do not need the heavier regional shelves yet.',
    includes: [
      'Single-file global PMTiles atlas',
      'Fastest way to keep worldwide map context handy',
      'Pairs well with Base Atlas and one regional shelf',
    ],
  },
  {
    id: 'map-california-solo',
    title: 'California Solo',
    subtitle: 'One-state West Coast map shelf',
    url: 'https://github.com/RoachWares/RoachNet-Maps/raw/refs/heads/master/pmtiles/california_2025-12.pmtiles',
    sizeBytes: 1185114056,
    status: 'High-detail state pack',
    accent: 'blue',
    machineFit: 'Best when you want deep California coverage without the whole Pacific shelf',
    summary:
      'A single-state California shelf for city grids, coast runs, mountain passes, and all the weird stretches in between.',
    includes: [
      'Focused California PMTiles install',
      'Good when one state matters more than the whole region',
      'Still lands directly in the native Maps lane',
    ],
  },
  {
    id: 'map-texas-solo',
    title: 'Texas Solo',
    subtitle: 'One-state South Central map shelf',
    url: 'https://github.com/RoachWares/RoachNet-Maps/raw/refs/heads/master/pmtiles/texas_2025-12.pmtiles',
    sizeBytes: 903490126,
    status: 'High-detail state pack',
    accent: 'bronze',
    machineFit: 'Best when you need Texas coverage without carrying the whole regional pack',
    summary:
      'A focused Texas shelf for metro sprawl, long highway cuts, border corridors, and the empty miles between them.',
    includes: [
      'Focused Texas PMTiles install',
      'Useful when one big state is the whole trip',
      'Lets the regional shelves stay optional',
    ],
  },
  {
    id: 'map-florida-solo',
    title: 'Florida Solo',
    subtitle: 'One-state coastal route shelf',
    url: 'https://github.com/RoachWares/RoachNet-Maps/raw/refs/heads/master/pmtiles/florida_2025-12.pmtiles',
    sizeBytes: 1072848714,
    status: 'High-detail state pack',
    accent: 'green',
    machineFit: 'Best when you want hurricane corridor and coastal sprawl coverage without the full South Atlantic lane',
    summary:
      'A focused Florida shelf for coastal sprawl, inland connectors, hurricane corridors, and the long flat drives in between.',
    includes: [
      'Focused Florida PMTiles install',
      'Good state-first travel shelf for the Southeast',
      'Queues into the same native Maps lane as the regional packs',
    ],
  },
  {
    id: 'map-new-york-solo',
    title: 'New York Solo',
    subtitle: 'One-state Northeast route shelf',
    url: 'https://github.com/RoachWares/RoachNet-Maps/raw/refs/heads/master/pmtiles/new_york_2025-12.pmtiles',
    sizeBytes: 541225235,
    status: 'Dense corridor pack',
    accent: 'violet',
    machineFit: 'Best when you want dense Northeast coverage without the whole Mid-Atlantic shelf',
    summary:
      'A focused New York shelf for city density, upstate routes, lake corridors, and everything between subway tunnels and back roads.',
    includes: [
      'Focused New York PMTiles install',
      'Good for dense-route travel without the full region',
      'Still works with the same contained Maps runtime',
    ],
  },
]

const curatedTierPacks = [
  {
    id: 'stack-dev-studio-essentials',
    title: 'Dev Studio Essentials',
    subtitle: 'Core coding docs for the native Dev lane',
    categorySlug: 'computing',
    tierSlug: 'computing-essential',
    status: 'Best first dev stack',
    accent: 'violet',
    machineFit: 'Good first install for RoachClaw and the native Dev workspace',
    summary:
      'Python docs, coding practice, and JavaScript fundamentals in one tier install for a fresh RoachNet Dev lane.',
    includes: [
      'Python Docs and Corey Schafer Python tutorials',
      'freeCodeCamp JavaScript algorithms',
      'Queues through the same desktop education-tier action',
    ],
    iconBand: 'Stack',
    iconMonogram: 'DEV',
    iconFamily: 'development',
  },
  {
    id: 'stack-security-privacy-essentials',
    title: 'Security & Privacy Essentials',
    subtitle: 'Security Q&A, Tor notes, and privacy reference',
    categorySlug: 'security-privacy',
    tierSlug: 'security-privacy-essential',
    status: 'Good first defense shelf',
    accent: 'cyan',
    machineFit: 'Small enough for most installs and useful beside RoachTail setup',
    summary:
      'A compact security and privacy stack for threat-model checks, Tor notes, and defensive reference from the Apps lane.',
    includes: [
      'Security Q&A',
      'Tor Q&A',
      'Installs as one named tier pack',
    ],
    iconBand: 'Stack',
    iconMonogram: 'SEC',
    iconFamily: 'security',
  },
  {
    id: 'stack-audio-production-essentials',
    title: 'Audio Production Essentials',
    subtitle: 'Theory and audio-reference shelves for studio work',
    categorySlug: 'music-audio',
    tierSlug: 'music-audio-essential',
    status: 'Studio starter',
    accent: 'magenta',
    machineFit: 'Fast add-on for label, studio, and music-production installs',
    summary:
      'Open Music Theory and Dalitio Music Theory bundled as a first audio shelf for the workstation.',
    includes: [
      'Open Music Theory',
      'Dalitio Music Theory',
      'Useful next to music tooling and RoachClaw notes',
    ],
    iconBand: 'Stack',
    iconMonogram: 'AUD',
    iconFamily: 'audio',
  },
  {
    id: 'stack-field-travel-essentials',
    title: 'Field Travel Essentials',
    subtitle: 'Travel guide shelf that pairs with offline maps',
    categorySlug: 'travel-field-guides',
    tierSlug: 'travel-field-guides-essential',
    status: 'Map companion',
    accent: 'blue',
    machineFit: 'Light install that belongs beside Base Atlas and Global Mini',
    summary:
      'Wikivoyage Europe staged as a practical travel shelf for checking routes, cities, and field notes offline.',
    includes: [
      'Wikivoyage Europe',
      'Travel notes that pair with RoachAtlas maps',
      'Desktop installs it through the education-tier lane',
    ],
    iconBand: 'Stack',
    iconMonogram: 'TRV',
    iconFamily: 'travel',
  },
  {
    id: 'stack-infra-operator-standard',
    title: 'Infra Operator Standard',
    subtitle: 'Ops docs for servers, databases, and containers',
    categorySlug: 'it-infrastructure',
    tierSlug: 'it-infrastructure-standard',
    status: 'Operator shelf',
    accent: 'bronze',
    machineFit: 'Best once the base runtime is settled and storage has room',
    summary:
      'Nginx, PostgreSQL, Redis, Docker, Kubernetes, Ask Ubuntu, Android, and DBA references in one operator stack.',
    includes: [
      'Nginx, PostgreSQL, Redis, Docker, and Kubernetes docs',
      'Ask Ubuntu, DBA, and Android Q&A shelves',
      'Built for long self-hosted maintenance sessions',
    ],
    iconBand: 'Stack',
    iconMonogram: 'OPS',
    iconFamily: 'infrastructure',
  },
  {
    id: 'stack-roacharcade-reference-standard',
    title: 'RoachArcade Reference Standard',
    subtitle: 'Game help, board rules, and dev answers',
    categorySlug: 'games-pop-culture',
    tierSlug: 'games-pop-culture-standard',
    status: 'Arcade side shelf',
    accent: 'magenta',
    machineFit: 'Good beside RoachArcade when the game lane needs answers, rules, or dev context',
    summary:
      'Gaming Q&A, board-game rules, game-development answers, and chess reference bundled as the offline side shelf for RoachArcade.',
    includes: [
      'Gaming, Board Games, Game Development, and Chess Q&A',
      'Useful beside emulation, mods, cheats, and backlog cleanup',
      'Installs through the existing games-pop-culture tier action',
    ],
    iconBand: 'Stack',
    iconMonogram: 'PLAY',
    iconFamily: 'culture',
  },
  {
    id: 'stack-vault-reader-compact',
    title: 'Vault Reader Compact',
    subtitle: 'Tiny dictionary shelf for the eBook lane',
    categorySlug: 'dictionaries-primary-sources',
    tierSlug: 'dictionaries-primary-sources-essential',
    status: 'Reader helper',
    accent: 'violet',
    machineFit: 'Tiny enough for every install and useful next to the Vault reader',
    summary:
      'A compact Wiktionary shelf for quick word checks while RoachNet keeps the larger book vault under your own roof.',
    includes: [
      'Simple English Wiktionary',
      'Pairs with the native Vault reader and RoachBrain notes',
      'Keeps lookup local instead of throwing the reader back into a browser',
    ],
    iconBand: 'Stack',
    iconMonogram: 'READ',
    iconFamily: 'library',
  },
  {
    id: 'stack-creator-lab-standard',
    title: 'Creator Lab Standard',
    subtitle: 'Design and graphics references for visual work',
    categorySlug: 'design-visual-media',
    tierSlug: 'design-visual-media-standard',
    status: 'Visual workbench',
    accent: 'violet',
    machineFit: 'Good for design-heavy Macs with room for a real graphics shelf',
    summary:
      'Blender and computer-graphics reference packed as a creator shelf for RoachNet projects, assets, and visual work.',
    includes: [
      'Blender Q&A',
      'Computer Graphics Q&A',
      'Useful beside media, app UI work, and asset cleanup',
    ],
    iconBand: 'Stack',
    iconMonogram: 'MAKE',
    iconFamily: 'design',
  },
  {
    id: 'stack-data-lab-standard',
    title: 'Data Lab Standard',
    subtitle: 'Stats, PyData, and ML docs in one shelf',
    categorySlug: 'machine-learning',
    tierSlug: 'machine-learning-standard',
    status: 'RoachClaw research shelf',
    accent: 'cyan',
    machineFit: 'Good second install for RoachClaw users doing data or model work',
    summary:
      'scikit-learn, PyTorch, TensorFlow, statistics, and data-science Q&A staged as a practical RoachClaw research shelf.',
    includes: [
      'scikit-learn, PyTorch, TensorFlow, and statistics docs',
      'Corey Schafer Pandas and Matplotlib tutorials',
      'Data Science Q&A for local troubleshooting',
    ],
    iconBand: 'Stack',
    iconMonogram: 'DATA',
    iconFamily: 'ml',
  },
  {
    id: 'stack-mac-maintenance-compact',
    title: 'Mac Maintenance Compact',
    subtitle: 'Package-manager and Linux docs for fixing machines',
    categorySlug: 'platforms-systems',
    tierSlug: 'platforms-systems-essential',
    status: 'Small repair kit',
    accent: 'bronze',
    machineFit: 'Small enough for every Apple Silicon install and useful when tooling gets loud',
    summary:
      'Homebrew Q&A plus Arch and Alpine docs as a small maintenance shelf for fixing local machines without waiting on a tab.',
    includes: [
      'Homebrew Q&A',
      'Arch Linux Docs',
      'Alpine Linux Docs',
    ],
    iconBand: 'Stack',
    iconMonogram: 'FIX',
    iconFamily: 'systems',
  },
]

function formatSizeFromMB(sizeMB) {
  if (!Number.isFinite(sizeMB) || sizeMB <= 0) {
    return 'Unknown size'
  }

  if (sizeMB >= 1024) {
    const sizeGB = sizeMB / 1024
    return `${sizeGB >= 10 ? sizeGB.toFixed(0) : sizeGB.toFixed(1)} GB`
  }

  return `${Math.round(sizeMB)} MB`
}

function formatSizeFromBytes(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return 'Unknown size'
  }

  return formatSizeFromMB(sizeBytes / (1024 * 1024))
}

function basenameFromUrl(url) {
  try {
    return path.basename(new URL(url).pathname)
  } catch {
    return ''
  }
}

function artifactUrl(key) {
  return `${artifactOrigin.publicBaseUrl}/${key}`
}

function descriptorKeyForArchiveKey(key) {
  if (/\.json$/i.test(key)) return key
  if (/\.[^/.]+$/.test(key)) return key.replace(/\.[^/.]+$/i, '.json')
  return `${key}.json`
}

function mirrorArtifact(key, options = {}) {
  return {
    provider: artifactOrigin.provider,
    engine: artifactOrigin.engine,
    key: descriptorKeyForArchiveKey(key),
    url: artifactUrl(descriptorKeyForArchiveKey(key)),
    status: options.status || 'descriptor-backed',
    sourceUrl: options.sourceUrl || null,
    checksumUrl: options.checksum ? artifactUrl(`${key}.sha256`) : null,
    mirrorPolicy: artifactOrigin.mirrorPolicy,
    note: options.note || 'Installed through a same-origin Apps descriptor with public sources and checksums.',
  }
}

function sourceMirrorArtifact(key, sourceUrl, options = {}) {
  return mirrorArtifact(key, {
    sourceUrl,
    status: options.status || 'source-with-managed-mirror',
    note:
      options.note ||
      'RoachNet keeps the canonical source visible and uses the Apps descriptor when a managed source is staged.',
  })
}

function titleCaseWords(value) {
  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function shortMonogram(value, maxLength = 3) {
  const segments = String(value)
    .split(/[^a-z0-9]+/gi)
    .filter(Boolean)

  if (segments.length >= 2) {
    return segments
      .slice(0, 3)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join('')
      .slice(0, maxLength)
  }

  const compact = segments.join('').replace(/[^a-z0-9]/gi, '').toUpperCase()
  return compact.slice(0, maxLength) || 'RN'
}

const iconNoiseTokens = new Set([
  'A',
  'AN',
  'AND',
  'THE',
  'OF',
  'FOR',
  'TO',
  'IN',
  'ON',
  'WITH',
  'ALL',
  'VIA',
  'Q',
  'QA',
  'DOC',
  'DOCS',
  'GUIDE',
  'GUIDES',
  'TUTORIAL',
  'TUTORIALS',
  'CONFERENCE',
  'INTERACTIVE',
  'SIMULATIONS',
])

function iconTokens(value) {
  return (String(value || '').toUpperCase().match(/[A-Z0-9]+/g) || []).filter(
    (token) => token && !iconNoiseTokens.has(token)
  )
}

function cleanIconCode(value, maxLength = 4) {
  return String(value || '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength)
}

function iconBandForResource(categorySlug, resource) {
  const title = String(resource.title || '').toLowerCase()
  const url = String(resource.url || '')

  if (title.startsWith('wikibooks')) return 'Wikib'
  if (title.startsWith('wikiversity')) return 'Wikiv'
  if (title.startsWith('libretexts')) return 'Libre'
  if (title.startsWith('ted')) return 'TED'
  if (title.includes('q&a') || url.includes('/stack_exchange/')) return 'Stack'
  if (url.includes('/freecodecamp/')) return 'FCC'
  if (url.includes('/videos/coreyms_')) return 'Corey'
  if (url.includes('/videos/studio.blender.org')) return 'Studio'
  if (url.includes('/videos/avanti-')) return 'Avanti'
  if (url.includes('/zimit/anonymousplanet.org')) return 'Anon'
  if (url.includes('/zimit/cheatography.com')) return 'Cheat'
  if (url.includes('/zimit/citizensinformation.ie')) return 'Civic'
  if (url.includes('/zimit/edu.gcfglobal.org')) return 'GCF'
  if (url.includes('/zimit/ethanweed')) return 'Weed'
  if (url.includes('/zimit/htdp.org')) return 'HtDP'
  if (url.includes('/zimit/internet-encyclopedia-philosophy')) return 'IEP'
  if (url.includes('/zimit/jeffe.cs.illinois.edu')) return 'Algo'
  if (url.includes('/zimit/lost-stats.github.io')) return 'Stats'
  if (url.includes('/zimit/apod.nasa.gov')) return 'APOD'
  if (url.includes('/zimit/cd3wdproject.org')) return 'Field'
  if (url.includes('/zimit/fretmap.app')) return 'Fret'
  if (url.includes('/zimit/celticscores.com')) return 'Score'
  if (url.includes('/other/ibanezwiki')) return 'Ibanez'
  if (url.includes('/other/chopin.lib.uchicago.edu')) return 'Chopin'
  if (url.includes('/zimit/based.cooking')) return 'Cook'
  if (url.includes('/zimit/grimgrains')) return 'Grain'
  if (url.includes('/zimit/devhints.io')) return 'Hints'
  if (url.includes('/zimit/docs.python.org')) return 'Python'
  if (url.includes('/zimit/getbootstrap.com')) return 'Boot'
  if (url.includes('/zimit/lua.org')) return 'Lua'
  if (url.includes('/zimit/dart.dev')) return 'Dart'
  if (url.includes('/zimit/incognitocat.me')) return 'Incog'
  if (url.includes('/zimit/learningstatisticswithr.com')) return 'LSR'
  if (url.includes('/devdocs/')) return 'Docs'
  if (url.includes('/zimit/openmusictheory.com')) return 'Theory'
  if (url.includes('/zimit/music.dalitio.de')) return 'Dalitio'
  if (url.includes('/zimit/cloudflare.com')) return 'Cloud'
  if (url.includes('/phet/')) return 'PhET'
  if (url.includes('/wikivoyage/')) return 'Voyage'
  if (url.includes('/wiktionary/')) return 'Dict'
  if (url.includes('/wikisource/')) return 'Source'
  if (url.includes('/gutenberg/')) return 'Guten'
  if (url.includes('/other/allthetropes')) return 'Tropes'
  if (url.includes('/other/bulbagarden')) return 'Bulba'
  if (url.includes('/other/citizendium')) return 'Civic'
  if (url.includes('/other/archlinux')) return 'Arch'
  if (url.includes('/other/alpinelinux')) return 'Alpine'
  if (url.includes('/other/gentoo')) return 'Gentoo'

  return categoryBands[categorySlug] || 'Roach'
}

function iconMonogramCandidates(resource) {
  const titleTokens = iconTokens(resource.title)
  const idTokens = iconTokens(resource.id)
  const candidates = []

  const push = (value) => {
    const code = cleanIconCode(value)
    if (code.length >= 2 && !candidates.includes(code)) {
      candidates.push(code)
    }
  }

  if (titleTokens.length >= 2) push(titleTokens.map((token) => token[0]).join('').slice(0, 4))
  if (titleTokens[0]) push(titleTokens[0].slice(0, 4))
  if (titleTokens[0] && titleTokens[1]) push(`${titleTokens[0].slice(0, 3)}${titleTokens[1][0]}`)
  if (titleTokens[0] && titleTokens[1]) push(`${titleTokens[0].slice(0, 2)}${titleTokens[1].slice(0, 2)}`)
  if (titleTokens[0] && titleTokens.length >= 2) {
    push(`${titleTokens[0].slice(0, 2)}${titleTokens[titleTokens.length - 1].slice(0, 2)}`)
  }
  if (titleTokens[0] && titleTokens[0].length > 4) {
    push(`${titleTokens[0].slice(0, 3)}${titleTokens[0].slice(-1)}`)
  }

  if (idTokens.length >= 2) push(idTokens.map((token) => token[0]).join('').slice(0, 4))
  if (idTokens[0]) push(idTokens[0].slice(0, 4))
  if (idTokens[0] && idTokens[1]) push(`${idTokens[0].slice(0, 2)}${idTokens[1].slice(0, 2)}`)

  push(shortMonogram(resource.title, 4))

  return candidates.length ? candidates : ['RN']
}

function ensureUniqueIconMonograms(items) {
  const used = new Set()

  items.forEach((item) => {
    const band = item.iconBand || 'Roach'
    const candidates = Array.isArray(item.__iconCandidates) ? item.__iconCandidates : []
    let chosen = candidates.find((candidate) => !used.has(`${band}::${candidate}`))

    if (!chosen) {
      const seed = cleanIconCode(candidates[0] || 'RN')
      let suffix = 2
      while (!chosen) {
        const candidate = cleanIconCode(`${seed.slice(0, Math.max(1, 4 - String(suffix).length))}${suffix}`)
        if (!used.has(`${band}::${candidate}`)) {
          chosen = candidate
        }
        suffix += 1
      }
    }

    item.iconMonogram = chosen
    used.add(`${band}::${chosen}`)
    delete item.__iconCandidates
  })

  return items
}

function resourceHighlights(resources, limit = 3) {
  return resources.slice(0, limit).map((resource) => resource.title)
}

function tierLevel(slug) {
  if (slug.includes('essential')) return 'essential'
  if (slug.includes('standard')) return 'standard'
  return 'comprehensive'
}

function iconAccentForTier(categorySlug, tierSlug) {
  const base = categoryAccents[categorySlug] || 'blue'
  const level = tierLevel(tierSlug)

  if (level === 'standard' && base === 'green') return 'cyan'
  if (level === 'comprehensive' && base === 'blue') return 'violet'
  if (level === 'comprehensive' && base === 'green') return 'gold'
  return base
}

function machineFitForSize(sizeMB) {
  if (!Number.isFinite(sizeMB) || sizeMB <= 0) {
    return 'Good for any healthy RoachNet install'
  }

  if (sizeMB <= 128) {
    return 'Fast add-on for any supported machine'
  }

  if (sizeMB <= 1024) {
    return 'Easy install once the core workspace is already healthy'
  }

  if (sizeMB <= 4096) {
    return 'Best on installs with real storage headroom'
  }

  return 'Large offline shelf best staged after the main runtime is settled'
}

function iconAssetForItem(id) {
  return `./assets/app-icons/${id}.svg`
}

function iconFamilyForCategorySlug(categorySlug) {
  return (
    {
      medicine: 'medicine',
      survival: 'survival',
      education: 'education',
      'science-simulations': 'science',
      'kids-family': 'kids',
      'open-courses': 'courses',
      'math-logic': 'math',
      'law-history-society': 'civic',
      'language-writing': 'language',
      diy: 'repair',
      'maker-electronics': 'maker',
      agriculture: 'agriculture',
      'finance-crypto': 'finance',
      computing: 'development',
      'machine-learning': 'ml',
      'platforms-systems': 'systems',
      'security-privacy': 'security',
      'music-audio': 'audio',
      'design-visual-media': 'design',
      'it-infrastructure': 'infrastructure',
      'travel-field-guides': 'travel',
      'travel-mobility-outdoors': 'travel',
      'games-pop-culture': 'culture',
      'homestead-sustainability': 'homestead',
      'dictionaries-primary-sources': 'library',
    }[categorySlug] || 'general'
  )
}

function sourceLabelForResource(resource) {
  const url = resource.url || ''

  if (url.includes('/freecodecamp/')) return 'freeCodeCamp via Kiwix'
  if (url.includes('/videos/coreyms_')) return 'Corey Schafer via Kiwix'
  if (url.includes('/videos/biologycourses_')) return 'Biology Courses via Kiwix'
  if (url.includes('/videos/studio.blender.org')) return 'Blender Studio via Kiwix'
  if (url.includes('/videos/avanti-')) return 'Avanti via Kiwix'
  if (url.includes('/zimit/anonymousplanet.org')) return 'Anonymous Planet via Kiwix'
  if (url.includes('/zimit/cheatography.com')) return 'Cheatography via Kiwix'
  if (url.includes('/zimit/citizensinformation.ie')) return 'Citizens Information via Kiwix'
  if (url.includes('/zimit/edu.gcfglobal.org')) return 'GCFGlobal via Kiwix'
  if (url.includes('/zimit/ethanweed')) return 'Ethan Weed via Kiwix'
  if (url.includes('/zimit/htdp.org')) return 'How to Design Programs via Kiwix'
  if (url.includes('/zimit/internet-encyclopedia-philosophy')) return 'Internet Encyclopedia of Philosophy via Kiwix'
  if (url.includes('/zimit/jeffe.cs.illinois.edu')) return 'Jeff Erickson via Kiwix'
  if (url.includes('/zimit/lost-stats.github.io')) return 'Lost Stats via Kiwix'
  if (url.includes('/zimit/apod.nasa.gov')) return 'NASA APOD via Kiwix'
  if (url.includes('/zimit/cd3wdproject.org')) return 'CD3WD via Kiwix'
  if (url.includes('/zimit/fretmap.app')) return 'FretMap via Kiwix'
  if (url.includes('/zimit/celticscores.com')) return 'Celtic Scores via Kiwix'
  if (url.includes('/other/ibanezwiki')) return 'Ibanez Wiki via Kiwix'
  if (url.includes('/other/chopin.lib.uchicago.edu')) return 'Chopin Early Editions via Kiwix'
  if (url.includes('/zimit/based.cooking')) return 'Based Cooking via Kiwix'
  if (url.includes('/zimit/grimgrains')) return 'Grim Grains via Kiwix'
  if (url.includes('/zimit/devhints.io')) return 'Devhints via Kiwix'
  if (url.includes('/zimit/docs.python.org')) return 'Python Docs via Kiwix'
  if (url.includes('/zimit/getbootstrap.com')) return 'Bootstrap via Kiwix'
  if (url.includes('/zimit/lua.org')) return 'Lua.org via Kiwix'
  if (url.includes('/zimit/dart.dev')) return 'Dart via Kiwix'
  if (url.includes('/zimit/incognitocat.me')) return 'Incognito Cat via Kiwix'
  if (url.includes('/zimit/gobyexample.com')) return 'Go by Example via Kiwix'
  if (url.includes('/zimit/learningstatisticswithr.com')) return 'Learning Statistics with R via Kiwix'
  if (url.includes('/zimit/milneopentextbooks.org')) return 'Milne Open Textbooks via Kiwix'
  if (url.includes('/zimit/planetmath.org')) return 'PlanetMath via Kiwix'
  if (url.includes('/zimit/stacks.math.columbia.edu')) return 'Stacks Project via Kiwix'
  if (url.includes('/devdocs/')) return 'DevDocs via Kiwix'
  if (url.includes('/ted/')) return 'TED via Kiwix'
  if (url.includes('/zimit/openmusictheory.com')) return 'Open Music Theory via Kiwix'
  if (url.includes('/zimit/music.dalitio.de')) return 'Dalitio via Kiwix'
  if (url.includes('/zimit/cloudflare.com')) return 'Cloudflare Learning Center via Kiwix'
  if (url.includes('/libretexts/')) return 'LibreTexts via Kiwix'
  if (url.includes('/stack_exchange/')) return 'Stack Exchange via Kiwix'
  if (url.includes('/phet/')) return 'PhET via Kiwix'
  if (url.includes('/vikidia/')) return 'Vikidia via Kiwix'
  if (url.includes('/wikiquote/')) return 'Wikiquote via Kiwix'
  if (url.includes('/wikinews/')) return 'Wikinews via Kiwix'
  if (url.includes('/wikivoyage/')) return 'Wikivoyage via Kiwix'
  if (url.includes('/wiktionary/')) return 'Wiktionary via Kiwix'
  if (url.includes('/wikisource/')) return 'Wikisource via Kiwix'
  if (url.includes('/gutenberg/')) return 'Project Gutenberg via Kiwix'
  if (url.includes('/other/africanstorybook.org')) return 'African Storybook via Kiwix'
  if (url.includes('/other/allthetropes')) return 'All The Tropes via Kiwix'
  if (url.includes('/other/bulbagarden')) return 'Bulbagarden via Kiwix'
  if (url.includes('/other/citizendium')) return 'Citizendium via Kiwix'
  if (url.includes('/other/khanacademy')) return 'Khan Academy via Kiwix'
  if (url.includes('/other/crashcourse')) return 'Crash Course via Kiwix'
  if (url.includes('/other/artofproblemsolving')) return 'Art of Problem Solving via Kiwix'
  if (url.includes('/other/appropedia')) return 'Appropedia via Kiwix'
  if (url.includes('/other/energypedia')) return 'Energypedia via Kiwix'
  if (url.includes('/other/finiki')) return 'Finiki via Kiwix'
  if (url.includes('/other/bogleheads')) return 'Bogleheads via Kiwix'
  if (url.includes('/other/bitcoin_')) return 'Bitcoin Wiki via Kiwix'
  if (url.includes('/other/edutechwiki')) return 'EdutechWiki via Kiwix'
  if (url.includes('/other/explainxkcd')) return 'Explain XKCD via Kiwix'
  if (url.includes('/other/folgerpedia.folger.edu')) return 'Folgerpedia via Kiwix'
  if (url.includes('/other/hitchwiki')) return 'Hitchwiki via Kiwix'
  if (url.includes('/other/archlinux')) return 'Arch Linux docs via Kiwix'
  if (url.includes('/other/alpinelinux')) return 'Alpine Linux docs via Kiwix'
  if (url.includes('/other/gentoo')) return 'Gentoo docs via Kiwix'

  return 'RoachNet knowledge mirror'
}

function summaryForResource(categorySlug, resource, tierLabel) {
  const bandName = {
    medicine: 'care shelf',
    survival: 'field shelf',
    education: 'study shelf',
    'science-simulations': 'science shelf',
    'kids-family': 'family shelf',
    'open-courses': 'course shelf',
    'math-logic': 'math shelf',
    'law-history-society': 'civic shelf',
    'language-writing': 'language shelf',
    diy: 'repair shelf',
    'maker-electronics': 'maker shelf',
    agriculture: 'grow shelf',
    'finance-crypto': 'finance shelf',
    computing: 'dev shelf',
    'machine-learning': 'ML shelf',
    'platforms-systems': 'systems shelf',
    'security-privacy': 'security shelf',
    'music-audio': 'audio shelf',
    'design-visual-media': 'design shelf',
    'it-infrastructure': 'ops shelf',
    'travel-field-guides': 'travel shelf',
    'travel-mobility-outdoors': 'mobility shelf',
    'games-pop-culture': 'culture shelf',
    'homestead-sustainability': 'homestead shelf',
    'dictionaries-primary-sources': 'library shelf',
  }[categorySlug] || 'knowledge shelf'

  const sourceUrl = String(resource.url || '').toLowerCase()
  const title = String(resource.title || '').toLowerCase()
  const description = String(resource.description || '').trim().replace(/\.$/, '')

  let lead = ''

  if (sourceUrl.includes('/devdocs/')) {
    lead = 'Offline language and framework docs that fit right into the long Dev Studio session.'
  } else if (sourceUrl.includes('/stack_exchange/')) {
    lead = 'Crowd-tested answers, rabbit holes, and practical fixes packed into one named shelf.'
  } else if (sourceUrl.includes('/phet/')) {
    lead = 'Interactive sims for testing ideas instead of just reading about them.'
  } else if (sourceUrl.includes('/ted/')) {
    lead = 'Talk libraries and lecture bundles sized like a real shelf instead of a random video binge.'
  } else if (sourceUrl.includes('/libretexts/')) {
    lead = 'Course-style textbooks laid out like real classes, not a folder full of stray PDFs.'
  } else if (sourceUrl.includes('/gutenberg/')) {
    lead = 'Public-domain books and long-form reading that belong on the machine, not lost in tabs.'
  } else if (sourceUrl.includes('/wikivoyage/')) {
    lead = 'City notes, route context, and practical travel reference in one install.'
  } else if (sourceUrl.includes('/wiktionary/')) {
    lead = 'Fast dictionary lookup and language cross-reference in a compact shelf.'
  } else if (sourceUrl.includes('/wikisource/')) {
    lead = 'Primary sources, older texts, and quote-heavy reading packed into one lane.'
  } else if (sourceUrl.includes('/wikiquote/')) {
    lead = 'A tighter quote shelf for writers, sample hunters, and midnight reference dives.'
  } else if (sourceUrl.includes('/other/khanacademy')) {
    lead = 'Lessons, worked examples, and practice-first study material in one named course app.'
  } else if (sourceUrl.includes('/other/crashcourse')) {
    lead = 'Fast-moving video courses and explainers for the topics you end up chasing at 2 AM.'
  } else if (sourceUrl.includes('/freecodecamp/')) {
    lead = 'Dev courses and hands-on explainers that feel at home next to the editor.'
  } else if (title.includes('wikibooks')) {
    lead = 'Open textbooks across math, science, computing, and more in one clean shelf.'
  } else if (title.includes('wikiversity')) {
    lead = 'Community-built courses and guided study paths when you want more than isolated articles.'
  } else if (title.includes('medlineplus')) {
    lead = 'Condition, symptom, and medicine reference that stays readable when you need answers fast.'
  } else if (title.includes('wikipedia medicine')) {
    lead = 'Medical articles, diagrams, and condition reference in one heavier but useful lane.'
  } else if (description) {
    lead = `${description}.`
  } else {
    lead = `A named ${bandName} install that keeps the useful material close.`
  }

  return `${lead} ${resource.title} lands as its own ${bandName} app inside RoachNet with a clear shelf, route, and install intent.`
}

function modelPackInstallLabel() {
  return 'Install to RoachNet'
}

function toCatalog() {
  return Promise.all([
    readFile(paths.maps, 'utf8').then(JSON.parse),
    readFile(paths.kiwix, 'utf8').then(JSON.parse),
    readFile(paths.wikipedia, 'utf8').then(JSON.parse),
    readFile(paths.packs, 'utf8').then(JSON.parse),
  ]).then(([mapsData, kiwixData, wikipediaData, packsData]) => {
    const baseAtlas = {
      id: 'base-atlas',
      title: 'Base Atlas',
      subtitle: 'Core renderer and shared basemap',
      category: 'Maps',
      section: 'Map Regions',
      size: '320 MB',
      status: 'Required first install',
      source: 'RoachNet mirror',
      summary:
        'Install the shared vector atlas and base map assets first so every regional collection opens cleanly inside the native Maps lane.',
      featured: true,
      accent: 'blue',
      machineFit: 'Best first install on every supported machine',
      includes: [
        'Shared vector atlas and renderer assets',
        'Required before regional map collections',
        'Installs directly into the native Maps lane',
      ],
      installLabel: modelPackInstallLabel(),
      detailLabel: 'View manifest',
      detailUrl: './collections/maps.json',
      installIntent: {
        action: 'base-map-assets',
      },
      artifact: mirrorArtifact('maps/base-atlas/manifest.json', {
        status: 'manifest-backed',
        note: 'Base map assets are resolved by the native installer from the Apps catalog and downloads bucket.',
      }),
      iconBand: 'RoachNet',
      iconMonogram: 'MAP',
      iconFamily: 'maps',
      iconAsset: iconAssetForItem('base-atlas'),
    }

    const mapItems = mapsData.collections.map((collection, index) => {
      const totalSizeMB = collection.resources.reduce((sum, resource) => sum + (resource.size_mb || 0), 0)
      const regionNames = collection.resources
        .slice(0, 5)
        .map((resource) => titleCaseWords(resource.title))
        .join(', ')

      return {
        id: `map-${collection.slug}`,
        title: collection.name,
        subtitle: regionNames,
        category: 'Maps',
        section: 'Map Regions',
        size: formatSizeFromMB(totalSizeMB),
        status: index === 0 ? 'Recommended first region' : 'Ready',
        source: 'RoachNet map mirror',
        summary: collection.description,
        accent: mapAccentCycle[index % mapAccentCycle.length],
        machineFit:
          totalSizeMB <= 4096
            ? 'Good first regional lane once Base Atlas is installed'
            : 'Best staged after the runtime and map lane are already healthy',
        includes: [
          `${collection.resources.length} regional map resources`,
          ...resourceHighlights(collection.resources, 2),
        ],
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open collection manifest',
        detailUrl: './collections/maps.json',
        installIntent: {
          action: 'map-collection',
          slug: collection.slug,
        },
        artifact: mirrorArtifact(`maps/collections/${collection.slug}/manifest.json`, {
          status: 'manifest-backed',
          note: 'Regional map collections resolve through the Apps catalog and same-origin descriptors when managed assets are available.',
        }),
        iconBand: 'Maps',
        iconMonogram: shortMonogram(collection.name),
        iconFamily: 'maps',
        iconAsset: iconAssetForItem(`map-${collection.slug}`),
      }
    })

    const educationItems = kiwixData.categories.flatMap((category) =>
      category.tiers.flatMap((tier) => {
        const level = tierLevel(tier.slug)
        const tierLabel = titleCaseWords(tier.name)

        return tier.resources.filter(resourceIsAvailable).map((resource) => ({
          id: `course-${resource.id}`,
          title: resource.title,
          subtitle: resource.description,
          category: tierLabel,
          section: category.name,
          size: formatSizeFromMB(resource.size_mb),
          status: courseStatusMap[level] || 'Ready',
          source: sourceLabelForResource(resource),
          summary: summaryForResource(category.slug, resource, tierLabel),
          accent: iconAccentForTier(category.slug, tier.slug),
          machineFit: machineFitForSize(resource.size_mb),
          includes: [
            resource.description,
            `Part of the ${tierLabel.toLowerCase()} ${category.name.toLowerCase()} shelf`,
            `Version ${resource.version}`,
          ],
          installLabel: modelPackInstallLabel(),
          detailLabel: 'Open manifest',
          detailUrl: './collections/kiwix-categories.json',
          installIntent: {
            action: 'education-resource',
            category: category.slug,
            resource: resource.id,
          },
          artifact: sourceMirrorArtifact(`content/zim/${basenameFromUrl(resource.url) || `${resource.id}.zim`}`, resource.url, {
            status: 'source-with-managed-mirror',
            note: 'The source library remains visible; RoachNet can prefer an Apps descriptor once that object is staged.',
          }),
          iconBand: iconBandForResource(category.slug, resource),
          iconFamily: iconFamilyForCategorySlug(category.slug),
          iconAsset: iconAssetForItem(`course-${resource.id}`),
          __iconCandidates: iconMonogramCandidates(resource),
        }))
      })
    )

    ensureUniqueIconMonograms(educationItems)

    const stackItems = curatedTierPacks.map((pack) => {
      const category = kiwixData.categories.find((candidate) => candidate.slug === pack.categorySlug)
      const tier = category?.tiers.find((candidate) => candidate.slug === pack.tierSlug)
      const resources = (tier?.resources || []).filter(resourceIsAvailable)
      const totalSizeMB = resources.reduce((sum, resource) => sum + (resource.size_mb || 0), 0)

      return {
        id: pack.id,
        title: pack.title,
        subtitle: pack.subtitle,
        category: 'Starter Stacks',
        section: 'Starter Stacks',
        size: formatSizeFromMB(totalSizeMB),
        status: pack.status,
        source: 'RoachNet Apps',
        summary: pack.summary,
        featured: pack.id === 'stack-dev-studio-essentials',
        accent: pack.accent,
        machineFit: pack.machineFit,
        includes: pack.includes,
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open manifest',
        detailUrl: './collections/kiwix-categories.json',
        installIntent: {
          action: 'education-tier',
          category: pack.categorySlug,
          tier: pack.tierSlug,
        },
        artifact: mirrorArtifact(`content/stacks/${pack.id}/manifest.json`, {
          status: 'manifest-backed',
          note: 'Starter stacks stay as catalog manifests that point RoachNet at individual mirrored or source-backed objects.',
        }),
        iconBand: pack.iconBand,
        iconMonogram: pack.iconMonogram,
        iconFamily: pack.iconFamily,
        iconAsset: iconAssetForItem(pack.id),
      }
    })

    const wikipediaItems = wikipediaData.options
      .filter((option) => option.id !== 'none' && resourceIsAvailable(option))
      .map((option) => ({
        id: `wiki-${option.id}`,
        title: option.name,
        subtitle: option.description,
        category: 'Wikipedia',
        section: 'Wikipedia',
        size: formatSizeFromMB(option.size_mb),
        status: wikipediaStatusMap[option.id] || 'Ready',
        source: 'Kiwix mirror',
        summary:
          'Pick the Wikipedia footprint that matches this machine, then let RoachNet stage it as one named reference lane instead of a giant mystery download.',
        accent: option.id.includes('maxi') ? 'magenta' : option.id.includes('all') ? 'violet' : 'blue',
        machineFit:
          option.id === 'top-mini'
            ? 'Fastest encyclopedia option for first boot'
            : option.id.includes('all')
              ? 'Best for long-lived offline installs with real storage headroom'
              : 'Good balance of size and reach for daily offline lookup work',
        includes: [
          option.description,
          `Version ${option.version || 'current mirror'}`,
          'Queued directly into RoachNet’s Wikipedia lane',
        ],
        installLabel: modelPackInstallLabel(),
        detailLabel: 'View options',
        detailUrl: './collections/wikipedia.json',
        installIntent: {
          action: 'wikipedia-option',
          option: option.id,
        },
        artifact: sourceMirrorArtifact(`content/wikipedia/${basenameFromUrl(option.url) || `${option.id}.zim`}`, option.url, {
          status: 'source-with-managed-mirror',
          note: 'Wikipedia options keep Kiwix as the canonical source and reserve an Apps descriptor path for RoachNet-managed sources.',
        }),
        iconBand: 'WIKI',
        iconMonogram: shortMonogram(option.name),
        iconFamily: 'wikipedia',
        iconAsset: iconAssetForItem(`wiki-${option.id}`),
      }))

    const packItems = packsData.packs.map((pack) => {
      const resource = pack.resources?.[0] || {}
      const bytes = (pack.resources || []).reduce((sum, entry) => sum + (entry.bytes || 0), 0)
      const voice = pack.install?.kind === 'roachWhisper' ? 'listener' : 'narrator'
      return {
        id: `pack-${pack.id}`,
        title: pack.name,
        subtitle: pack.summary,
        category: 'Feature Packs',
        section: 'Feature Packs',
        size: formatSizeFromBytes(bytes),
        status: 'RoachNet 1.1 or later',
        source: 'Apps descriptor + Internet Archive mirror',
        summary: `${pack.summary} Installs through Settings › Packs in RoachNet 1.1: the runtime checks the published SHA-256 before anything is unpacked, and Remove keeps your data unless you say otherwise.`,
        accent: voice === 'listener' ? 'cyan' : 'violet',
        machineFit: bytes > 1_000_000_000 ? 'Large pack — best on Macs with real storage headroom' : 'Fits any supported Apple Silicon Mac',
        includes: [
          `Pack id ${pack.id}, version ${pack.version}`,
          `Needs the ${pack.dependencies?.map((dependency) => dependency.id).join(', ') || 'core'} feature${(pack.dependencies?.length || 0) > 1 ? 's' : ''} switched on`,
          'Verified by checksum, installed transactionally, removable from Settings › Packs',
        ],
        minimumRoachNet: pack.requires?.roachnet || '1.1.0',
        installLabel: 'Install with Pack Manager',
        detailLabel: 'Open pack catalog',
        detailUrl: './collections/packs.json',
        installIntent: {
          action: 'pack',
          pack: pack.id,
        },
        artifact: {
          provider: artifactOrigin.provider,
          bucket: null,
          key: resource.path || null,
          url: resource.url || null,
          status: 'descriptor-backed',
          sourceUrl: resource.url || null,
          checksumUrl: resource.url ? resource.url.replace(/\.json$/, '.zip.sha256') : null,
          sha256: resource.sha256 || null,
          bytes,
          note: 'Feature packs resolve through the same signed descriptor the voice-pack lane uses; the manifest carries the digest the runtime verifies.',
        },
        iconBand: 'PACK',
        iconMonogram: shortMonogram(pack.name),
        iconFamily: 'voice',
        iconAsset: iconAssetForItem(`pack-${pack.id}`),
      }
    })

    const items = [
      { ...baseAtlas, availability: mapsAvailability },
      ...curatedMapPacks.map((item) => ({
        ...item,
        availability: mapsAvailability,
        category: 'Maps',
        section: 'Map Picks',
        size: formatSizeFromBytes(item.sizeBytes),
        source: 'RoachNet map mirror',
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open collection manifest',
        detailUrl: './collections/maps.json',
        installIntent: {
          action: 'direct-download',
          url: artifactUrl(descriptorKeyForArchiveKey(`maps/pmtiles/${basenameFromUrl(item.url)}`)),
          sourceUrl: item.url,
          mirrorUrl: artifactUrl(descriptorKeyForArchiveKey(`maps/pmtiles/${basenameFromUrl(item.url)}`)),
          artifactKey: `maps/pmtiles/${basenameFromUrl(item.url)}`,
          artifactProvider: artifactOrigin.provider,
          filetype: 'map',
        },
        artifact: sourceMirrorArtifact(`maps/pmtiles/${basenameFromUrl(item.url)}`, item.url, {
          status: 'source-with-managed-mirror',
          note: 'Direct map picks keep their original source and expose an Apps descriptor URL for the native installer when staged.',
        }),
        iconBand: 'Maps',
        iconFamily: 'maps',
        iconAsset: iconAssetForItem(item.id),
        iconMonogram: shortMonogram(item.title),
      })),
      ...mapItems.map((item) => ({ ...item, availability: mapsAvailability })),
      ...stackItems,
      ...educationItems,
      ...wikipediaItems,
      ...packItems,
      ...aiPacks.map((item) => ({
        ...item,
        ...(nativeUnsupportedModels[item.installIntent.model]
          ? { availability: { state: 'unsupported', reason: nativeUnsupportedModels[item.installIntent.model] } }
          : {}),
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open RoachClaw',
        detailUrl: 'https://roachnet.org/#screens',
        artifact: {
          provider: 'Contained Ollama runtime',
          bucket: null,
          key: item.installIntent.model,
          url: null,
          status: 'runtime-pull',
          sourceUrl: `ollama://${item.installIntent.model}`,
          checksumUrl: null,
          note: 'RoachClaw model packs are runtime pulls, not static ZIPs. The Apps catalog still owns the install handoff.',
        },
        iconFamily: 'models',
        iconAsset: iconAssetForItem(item.id),
      })),
      ...roachVoicePacks.map((item) => ({
        ...item,
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open RoachSpeech notes',
        detailUrl: 'https://roachnet.org/roachclaw/',
        iconAsset: iconAssetForItem(item.id),
      })),
    ]

    return {
      updatedAt: new Date().toISOString(),
      featuredId: 'base-atlas',
      artifactOrigin,
      items,
    }
  })
}

const catalog = await toCatalog()
await writeFile(paths.output, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
console.log(`Wrote ${catalog.items.length} App Store items to ${path.relative(repoRoot, paths.output)}`)
