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

// Map packs are release assets on github.com/RoachWares/RoachNet-Maps (maps-2026-10);
// scripts/build-map-packs.mjs writes their descriptors and collections/maps.json.
const mapPacksPath = path.join(repoRoot, 'collections/map-packs-2026-10.json')

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
  essential: 'Good first install',
  standard: 'Good next install',
  comprehensive: 'Further reading',
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
    subtitle: 'qwen2.5-coder:1.5b, the small first-boot coder',
    category: 'Local AI',
    section: 'Model Packs',
    size: '1.5 GB',
    status: 'Best first boot',
    source: 'Local model lane',
    summary:
      'Gets RoachClaw talking fast on a fresh Mac. This is the small coding model RoachNet recommends for first boot.',
    accent: 'violet',
    machineFit: 'Any Apple Silicon Mac, especially 16 GB machines',
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
    subtitle: 'qwen2.5-coder:3b, a step up for daily code help',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.0 GB',
    status: 'Light coding model',
    source: 'Local model lane',
    summary:
      'More room to think than Quickstart, without jumping to the heavy models. Better code help that leaves the rest of the Mac free.',
    accent: 'cyan',
    machineFit: 'Everyday Apple Silicon Macs that want small but useful code help',
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
    subtitle: 'qwen2.5-coder:7b for longer refactors',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.8 GB',
    status: 'For larger Apple Silicon Macs',
    source: 'Local model lane',
    summary:
      'The bigger local coder: longer refactors, stronger reasoning and more comfortable day-to-day help.',
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
    subtitle: 'qwen2.5:7b for notes, drafts and planning',
    category: 'Local AI',
    section: 'Model Packs',
    size: '4.7 GB',
    status: 'Everyday all-rounder',
    source: 'Local model lane',
    summary:
      'A broader local model for notes, drafts, planning and general questions, when you want less code and more conversation.',
    accent: 'cyan',
    machineFit: 'Macs with enough memory to leave a local model running',
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
    subtitle: 'llama3.2:3b for quick chat and short notes',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.0 GB',
    status: 'Fast everyday replies',
    source: 'Local model lane',
    summary:
      'A light general model for quick chat and short notes, when you want a local answer without loading a big one.',
    accent: 'green',
    machineFit: 'Any Mac where a fast-starting chat model matters more than depth',
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
    subtitle: 'gemma3:4b for reading and summaries',
    category: 'Local AI',
    section: 'Model Packs',
    size: '3.3 GB',
    status: 'Balanced research model',
    source: 'Local model lane',
    summary:
      'A middleweight model for reading, summarizing and working through ideas: broader than the coders, still fairly light.',
    accent: 'blue',
    machineFit: 'Apple Silicon Macs that want a mid-size model for reading and planning',
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
    subtitle: 'gemma3:12b for long reads and careful summaries',
    category: 'Local AI',
    section: 'Model Packs',
    size: '8.1 GB',
    status: 'Deep local analysis',
    source: 'Local model lane',
    summary:
      'A heavier analyst for longer reads, tighter summaries and more patient reasoning, for when the small models feel cramped.',
    accent: 'magenta',
    machineFit: 'Best on higher-memory Apple Silicon Macs',
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
    subtitle: 'qwen2.5-coder:14b for Macs with memory to spare',
    category: 'Local AI',
    section: 'Model Packs',
    size: '9.0 GB',
    status: 'Heavy local install',
    source: 'Local model lane',
    summary:
      'A bigger coding model for Macs with memory to spare, and the strongest Dev Studio partner RoachNet can comfortably run.',
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
    subtitle: 'qwen2.5-coder:32b, the heavyweight coder',
    category: 'Local AI',
    section: 'Model Packs',
    size: '19 GB',
    status: 'Big machine only',
    source: 'Local model lane',
    summary:
      'The heavyweight local coder, for Macs with real headroom. Queue this one when you want the strongest coding model RoachNet can sensibly carry.',
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
    subtitle: 'qwen3:4b, a newer small everyday model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '2.6 GB',
    status: 'Newer small model',
    source: 'Local model lane',
    summary:
      'A newer small model for notes, summaries and fast answers: sharper than the first-boot model, without waking the whole bunker.',
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
    subtitle: 'qwen3:8b for more patient everyday reasoning',
    category: 'Local AI',
    section: 'Model Packs',
    size: '5.2 GB',
    status: 'Better local thinking',
    source: 'Local model lane',
    summary:
      'A stronger everyday model for more patient local reasoning, without going straight to workstation-only sizes.',
    accent: 'cyan',
    machineFit: 'M-series Macs with the memory for an always-local assistant',
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
    subtitle: 'gpt-oss:20b, an open-weight reasoning model',
    category: 'Local AI',
    section: 'Model Packs',
    size: '13 GB',
    status: 'Heavy open-weight model',
    source: 'Local model lane',
    summary:
      'A heavy open-weight reasoning model for Macs with headroom. Not a first install on a cramped Mac, but it earns its space when the work gets thorny.',
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
    subtitle: 'qwen3-coder:30b for long-context coding',
    category: 'Local AI',
    section: 'Model Packs',
    size: '19 GB',
    status: 'Heavy coding model',
    source: 'Local model lane',
    summary:
      'A heavyweight coder for long-context work and big refactors. For Macs with headroom, not for pretending a small one is a server rack.',
    accent: 'blue',
    machineFit: 'Best on high-memory Apple Silicon or RoachTail-assisted multi-machine setups',
    includes: [
      'Contained Qwen3 Coder 30B model queue',
      'Long-context coding and agent work',
      'Optional, like every model here',
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
    status: 'Tiny and quick',
    source: 'Native RoachInference engine',
    summary:
      'A tiny model that answers instantly on any Apple Silicon Mac. Good for quick rewrites, summaries and command help; not for deep reasoning.',
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
    subtitle: 'Native qwen3:0.6b, tiny, with an optional thinking mode',
    category: 'Local AI',
    section: 'Model Packs',
    size: '0.4 GB',
    status: 'Micro model',
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
    status: 'Long-context all-rounder',
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
    status: 'Classic 7B',
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
      'SmolLM2 135M is a utility model, not a chat partner: classification, short completions, and smoke tests of the native engine on the smallest machines.',
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
    status: 'Low-memory assistant',
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
    subtitle: 'Voice cloning on your Mac, the heavy option',
    category: 'Voice AI',
    section: 'Voice Packs',
    size: '1.6 GB',
    status: 'Voice cloning',
    source: 'RoachSpeech Core ML pack',
    summary:
      'Full local voice cloning for RoachClaw: Chatterbox-derived Core ML speech, reference voices and no Python service hiding in the wall.',
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
    subtitle: 'A small read-aloud voice',
    category: 'Voice AI',
    section: 'Voice Packs',
    size: '77 MB',
    status: 'Baseline voice',
    source: 'RoachSpeech Core ML pack',
    summary:
      'A small Kokoro-derived narrator for read-aloud and basic local speech, when you don’t need cloning. Useful, boring and hard to kill.',
    accent: 'green',
    machineFit: 'Any Apple Silicon Mac. RoachNet 1.0.6 already ships with it built in',
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
    subtitle: 'Speech to text on your Mac, for transcripts and lyrics',
    category: 'Speech AI',
    section: 'Voice Packs',
    size: '128 MB',
    status: 'Baseline speech to text',
    source: 'RoachSpeech Core ML pack',
    summary:
      'Local speech to text for RoachSpeech: transcripts saved beside your vault media, and lyric extraction, without renting ears from a cloud.',
    accent: 'cyan',
    machineFit: 'Any Apple Silicon Mac. RoachNet 1.0.6 already ships with it built in',
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

// Single-file picks. Every one is a direct download, so RoachNet 1.0.6 installs them too.
const curatedMapPickSpecs = [
  {
    id: 'map-california-solo',
    slug: 'california',
    title: 'California Solo',
    subtitle: 'One state, coast to Sierra',
    status: 'High-detail state pack',
    accent: 'blue',
    machineFit: 'When California is the whole trip and the Pacific Region is more than you need',
    summary: 'Every street in California, from the Bay to the desert, in one file.',
    includes: ['Zoom 0–15, street level', 'Clipped to the state line, not a box', 'Same file the Pacific Region installs'],
  },
  {
    id: 'map-texas-solo',
    slug: 'texas',
    title: 'Texas Solo',
    subtitle: 'One state, a lot of highway',
    status: 'High-detail state pack',
    accent: 'bronze',
    machineFit: 'When you need Texas without the rest of West South Central',
    summary: 'Metro sprawl, border towns and the long empty miles between them, all on your disk.',
    includes: ['Zoom 0–15, street level', 'Clipped to the state line, not a box', 'Same file West South Central installs'],
  },
  {
    id: 'map-florida-solo',
    slug: 'florida',
    title: 'Florida Solo',
    subtitle: 'One state, mostly coastline',
    status: 'High-detail state pack',
    accent: 'green',
    machineFit: 'For hurricane season, road trips and anyone who has watched a cell tower go dark',
    summary: 'Coast roads, evacuation routes and inland connectors that still load when the network does not.',
    includes: ['Zoom 0–15, street level', 'Keys and barrier islands included', 'Same file the South Atlantic region installs'],
  },
  {
    id: 'map-new-york-solo',
    slug: 'new_york',
    title: 'New York Solo',
    subtitle: 'One state, city to Adirondacks',
    status: 'Dense corridor pack',
    accent: 'violet',
    machineFit: 'When you want New York without the rest of the Mid-Atlantic',
    summary: 'The five boroughs, the Thruway and the back roads upstate, readable with the Wi-Fi off.',
    includes: ['Zoom 0–15, street level', 'Clipped to the state line, not a box', 'Same file the Mid-Atlantic region installs'],
  },
  {
    id: 'map-dc-solo',
    slug: 'district_of_columbia',
    title: 'Washington, DC',
    subtitle: 'The District, block by block',
    status: 'New in 2026-10',
    accent: 'cyan',
    machineFit: 'Small enough to keep on every machine you own',
    summary: 'All of DC at street level in a file smaller than most podcasts. The old map shelf skipped DC; this one does not.',
    includes: ['Zoom 0–15, street level', 'Buffered a couple of km past the line', 'Works on RoachNet 1.0.6'],
  },
  {
    id: 'map-puerto-rico-solo',
    slug: 'puerto_rico',
    title: 'Puerto Rico',
    subtitle: 'The island, Vieques and Culebra',
    status: 'New in 2026-10',
    accent: 'gold',
    machineFit: 'For trips and storm seasons where the network is the first thing to go',
    summary: 'Puerto Rico and its outer islands at street level, in one small file.',
    includes: ['Zoom 0–15, street level', 'Vieques and Culebra included', 'Works on RoachNet 1.0.6'],
  },
]

const curatedTierPacks = [
  {
    id: 'stack-dev-studio-essentials',
    title: 'Dev Studio Essentials',
    subtitle: 'Core coding docs for the Dev workspace',
    categorySlug: 'computing',
    tierSlug: 'computing-essential',
    status: 'Best first dev stack',
    accent: 'violet',
    machineFit: 'Good first install for RoachClaw and the native Dev workspace',
    summary:
      'Python docs, coding practice and JavaScript fundamentals in one install, for a fresh Dev workspace.',
    includes: [
      'Python Docs and Corey Schafer Python tutorials',
      'freeCodeCamp JavaScript algorithms',
      'One install queues the whole stack',
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
      'A compact security and privacy stack for threat-model checks, Tor notes and defensive reference.',
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
    machineFit: 'Light install that pairs with the World Atlas and your state maps',
    summary:
      'Wikivoyage Europe staged as a practical travel shelf for checking routes, cities, and field notes offline.',
    includes: [
      'Wikivoyage Europe',
      'Travel notes that pair with RoachAtlas maps',
      'One install, filed under Travel',
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
    machineFit: 'Good beside RoachArcade when you need answers, rules or dev context',
    summary:
      'Gaming Q&A, board-game rules, game-development answers, and chess reference bundled as the offline side shelf for RoachArcade.',
    includes: [
      'Gaming, Board Games, Game Development, and Chess Q&A',
      'Useful beside emulation, mods, cheats, and backlog cleanup',
      'One install covers all four',
    ],
    iconBand: 'Stack',
    iconMonogram: 'PLAY',
    iconFamily: 'culture',
  },
  {
    id: 'stack-vault-reader-compact',
    title: 'Vault Reader Compact',
    subtitle: 'Tiny dictionary for the Vault reader',
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

  // Theme packs are a few KB; "0 MB" would read as empty.
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
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
    return 'Any supported Mac. It’s small.'
  }

  if (sizeMB <= 1024) {
    return 'Any Mac with a gigabyte free'
  }

  if (sizeMB <= 4096) {
    return 'Macs with a few gigabytes free'
  }

  return 'Macs with plenty of free disk and a good connection'
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
    lead = 'Language and framework references for the long coding session.'
  } else if (sourceUrl.includes('/stack_exchange/')) {
    lead = 'Real questions, voted answers and practical fixes from people who got there first.'
  } else if (sourceUrl.includes('/phet/')) {
    lead = 'Interactive sims for testing ideas instead of just reading about them.'
  } else if (sourceUrl.includes('/ted/')) {
    lead = 'Talks and lectures saved as one library, not a scattered video binge.'
  } else if (sourceUrl.includes('/libretexts/')) {
    lead = 'Course-style textbooks laid out like real classes, not a folder full of stray PDFs.'
  } else if (sourceUrl.includes('/gutenberg/')) {
    lead = 'Public-domain books for long reading, kept on your Mac instead of in a tab.'
  } else if (sourceUrl.includes('/wikivoyage/')) {
    lead = 'City notes, route context, and practical travel reference in one install.'
  } else if (sourceUrl.includes('/wiktionary/')) {
    lead = 'Fast dictionary lookup and language cross-reference in a compact shelf.'
  } else if (sourceUrl.includes('/wikisource/')) {
    lead = 'Primary sources, older texts and quote-heavy reading in one install.'
  } else if (sourceUrl.includes('/wikiquote/')) {
    lead = 'A tighter quote shelf for writers, sample hunters, and midnight reference dives.'
  } else if (sourceUrl.includes('/other/khanacademy')) {
    lead = 'Lessons, worked examples and practice, in one course library.'
  } else if (sourceUrl.includes('/other/crashcourse')) {
    lead = 'Quick, well-paced video courses for catching up on a subject.'
  } else if (sourceUrl.includes('/freecodecamp/')) {
    lead = 'Hands-on coding lessons and challenges to work through at your own pace.'
  } else if (title.includes('wikibooks')) {
    lead = 'Open textbooks across math, science, computing and more, on one shelf.'
  } else if (title.includes('wikiversity')) {
    lead = 'Community-built courses and guided study paths when you want more than isolated articles.'
  } else if (title.includes('medlineplus')) {
    lead = 'Condition, symptom, and medicine reference that stays readable when you need answers fast.'
  } else if (title.includes('wikipedia medicine')) {
    lead = 'Medical articles, diagrams and condition reference, in one larger install.'
  } else if (description) {
    lead = `${description}.`
  } else {
    lead = `A named ${bandName} install that keeps the useful material close.`
  }

  return `${lead} ${resource.title} gets its own ${bandName} in RoachNet and works offline.`
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
    readFile(mapPacksPath, 'utf8').then(JSON.parse),
  ]).then(([mapsData, kiwixData, wikipediaData, packsData, mapPacks]) => {
    const packBySlug = new Map(mapPacks.packs.map((pack) => [pack.slug, pack]))
    const mapPickItem = (pack, spec) => {
      if (!pack) throw new Error(`map pick ${spec.id} has no pack in ${mapPacks.release}`)
      const descriptorKey = `maps/pmtiles/${pack.file.replace(/\.pmtiles$/, '.json')}`
      const sourceUrl = `${mapPacks.assetBaseUrl}/${pack.file}`
      return {
        ...spec,
        category: 'Maps',
        section: spec.section || 'Map Picks',
        size: formatSizeFromBytes(pack.bytes),
        sizeBytes: pack.bytes,
        source: 'RoachNet Maps on GitHub',
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open the release',
        detailUrl: `https://github.com/${mapPacks.repo}/releases/tag/${mapPacks.release}`,
        installIntent: {
          action: 'direct-download',
          url: artifactUrl(descriptorKey),
          sourceUrl,
          mirrorUrl: artifactUrl(descriptorKey),
          artifactKey: `maps/pmtiles/${pack.file}`,
          artifactProvider: artifactOrigin.provider,
          filetype: 'map',
        },
        artifact: sourceMirrorArtifact(`maps/pmtiles/${pack.file}`, sourceUrl, {
          status: 'published',
          note: `Release asset with a published SHA-256 (${pack.sha256.slice(0, 12)}…). RoachNet verifies it after the download.`,
        }),
        iconBand: 'Maps',
        iconFamily: 'maps',
        iconAsset: iconAssetForItem(spec.id),
        iconMonogram: shortMonogram(spec.title),
      }
    }
    const worldPack = mapPacks.packs.find((pack) => pack.slug === 'global-min')
    const baseAtlas = mapPickItem(worldPack, {
      id: 'base-atlas',
      title: 'World Atlas',
      subtitle: 'The whole planet, zoom 0–7',
      section: 'Map Regions',
      status: 'Install this first',
      featured: true,
      accent: 'blue',
      machineFit: 'Best first map on every machine: small, and it fills in around every state pack',
      summary:
        'Coastlines, countries, major roads and cities for the entire world in one small file. Start here.',
      includes: ['Every country, zoom 0–7', 'Fills in around the state and territory packs', 'Works on RoachNet 1.0.6'],
    })

    const mapItems = mapsData.collections.map((collection, index) => {
      const totalSizeMB = collection.resources.reduce((sum, resource) => sum + (resource.size_mb || 0), 0)
      const regionTitles = collection.resources.map((resource) => String(resource.title || '').trim()).filter(Boolean)
      const regionNames =
        regionTitles.length > 5
          ? `${regionTitles.slice(0, 4).join(', ')} and ${regionTitles.length - 4} more`
          : regionTitles.join(', ')

      return {
        id: `map-${collection.slug}`,
        title: collection.name,
        subtitle: regionNames,
        category: 'Maps',
        section: 'Map Regions',
        size: formatSizeFromMB(totalSizeMB),
        status: collection.minimumRoachNet ? `Needs RoachNet ${collection.minimumRoachNet.replace(/\.0$/, '')}` : index === 0 ? 'Recommended first region' : 'Ready',
        source: 'RoachNet Maps on GitHub',
        summary: collection.description,
        accent: mapAccentCycle[index % mapAccentCycle.length],
        machineFit:
          totalSizeMB <= 4096
            ? 'A good first region once the World Atlas is in'
            : 'Big shelf: start it when the Mac can sit on Wi-Fi for a while',
        includes: [
          `${collection.resources.length} maps, one file each`,
          ...resourceHighlights(collection.resources, 2),
        ],
        installLabel: modelPackInstallLabel(),
        detailLabel: 'Open collection manifest',
        detailUrl: './collections/maps.json',
        installIntent: {
          action: 'map-collection',
          slug: collection.slug,
        },
        ...(collection.minimumRoachNet ? { minimumRoachNet: collection.minimumRoachNet } : {}),
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
          'Pick the size that fits this Mac. RoachNet files it as one named Wikipedia library, not a giant mystery download.',
        accent: option.id.includes('maxi') ? 'magenta' : option.id.includes('all') ? 'violet' : 'blue',
        machineFit:
          option.id === 'top-mini'
            ? 'The quickest Wikipedia to get onto a new Mac'
            : option.id.includes('all')
              ? 'Best on Macs with plenty of free disk'
              : 'A good balance of size and reach for everyday lookups',
        includes: [
          option.description,
          `Version ${option.version || 'current mirror'}`,
          'Goes straight into RoachNet’s Wikipedia library',
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

    // Theme packs (kind "theme", built by scripts/build-theme-packs.py) are
    // plain zips of theme JSON on this site; everything else is a resource
    // pack behind a signed descriptor.
    const themePackItem = (pack) => {
      const resource = pack.resources?.[0] || {}
      const bytes = (pack.resources || []).reduce((sum, entry) => sum + (entry.bytes || 0), 0)
      const themes = pack.themes || []
      return {
        id: `pack-${pack.id}`,
        title: pack.name,
        subtitle: pack.summary,
        category: 'Themes',
        section: 'Themes',
        size: formatSizeFromBytes(bytes),
        status: 'RoachNet 1.1 or later',
        source: 'RoachWares theme pack',
        summary: `${pack.summary} Installs through Settings › Packs in RoachNet 1.1, then shows up in Settings › Appearance next to the built-in themes. Themes are plain JSON: nothing in a pack runs code.`,
        accent: 'magenta',
        machineFit: 'Every Mac that runs RoachNet 1.1',
        includes: [
          ...(themes.length ? [`${themes.length} themes: ${themes.join(', ')}`] : []),
          `Pack id ${pack.id}, version ${pack.version}`,
          'Checked against its SHA-256, removable from Settings › Packs',
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
          status: 'direct-zip',
          sourceUrl: resource.url || null,
          checksumUrl: null,
          sha256: resource.sha256 || null,
          bytes,
          note: 'Theme packs are small zips served from apps.roachnet.org; the catalog entry carries the SHA-256 the runtime checks before it unpacks anything.',
        },
        iconBand: 'THEME',
        iconMonogram: shortMonogram(pack.name),
        iconFamily: 'themes',
        iconAsset: iconAssetForItem(`pack-${pack.id}`),
      }
    }

    const packItems = packsData.packs.map((pack) => {
      if (pack.kind === 'theme') return themePackItem(pack)
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
        machineFit: bytes > 1_000_000_000 ? 'Large pack — best on Macs with real storage headroom' : 'Any supported Apple Silicon Mac',
        includes: [
          `Pack id ${pack.id}, version ${pack.version}`,
          `Needs the ${pack.dependencies?.map((dependency) => dependency.id).join(', ') || 'core'} feature${(pack.dependencies?.length || 0) > 1 ? 's' : ''} switched on`,
          'Checked against its SHA-256, installed all-or-nothing, removable from Settings › Packs',
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
      baseAtlas,
      ...curatedMapPickSpecs.map((spec) => mapPickItem(packBySlug.get(spec.slug), spec)),
      ...mapItems,
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
        detailUrl: 'https://roachnet.org/home/#screens',
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
        detailLabel: 'About RoachClaw',
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
