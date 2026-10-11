// RoachNet Apps storefront (apps.roachnet.org).
// Renders app-store-catalog.json into a store: section rail, instant search,
// a Today view with shelf rows, section grids and a detail sheet. Install
// buttons are roachnet://install-content deep links built from each item's
// installIntent and handed to the native app by attemptNativeInstall.
// CSP note: the apps CSP is style-src 'self', so nothing here writes a style
// attribute into markup. Dynamic values go through CSSOM (style.setProperty).

const owner = 'RoachWares'
const repo = 'RoachNet'
const releaseVersion = window.__ROACHNET_SITE_CONFIG__?.releaseVersion || '1.0.6'
const latestDownloadBase = `https://github.com/${owner}/${repo}/releases/latest/download`
const hostedDownloads = {
  mac: {
    url: `${latestDownloadBase}/RoachNet-Setup-macOS.dmg`,
    name: 'RoachNet-Setup-macOS.dmg',
    version: releaseVersion,
  },
}

// key + navLabel are contracts: key matches catalog `section`, navLabel feeds the
// URL hash (#models, #voice, #medicine…). Everything else is presentation copy.
const sectionDefinitions = [
  {
    key: 'Today',
    navLabel: 'Today',
    eyebrow: 'Today in RoachNet Apps',
    title: 'Today in RoachNet Apps.',
    description: 'A featured pick, good first installs, and the newest shelves.',
    icon: 'NOW',
    group: 'Discover',
  },
  {
    key: 'Map Regions',
    navLabel: 'Map Regions',
    eyebrow: 'Offline atlas',
    title: 'Maps by region.',
    description:
      'City streets, highways, coastlines and the long empty bits in between, grouped into regional packs that open in RoachNet Maps without a signal.',
    short: 'Regional packs for RoachNet Maps. They come back once the new mirror is live.',
    icon: 'MAP',
    group: 'Maps',
  },
  {
    key: 'Map Picks',
    navLabel: 'Map Picks',
    eyebrow: 'Single-file maps',
    title: 'One place, one file.',
    description: 'Single-region PMTiles maps for when you need one state, not the whole continent.',
    icon: 'PIN',
    group: 'Maps',
  },
  {
    key: 'Starter Stacks',
    navLabel: 'Stacks',
    eyebrow: 'Starter stacks',
    title: 'A fresh RoachNet, set up in one go.',
    description:
      'Hand-picked bundles of shelves for one kind of work. One install queues the lot, and every shelf in it still gets its own name.',
    short: 'One install, several shelves, all filed where they belong.',
    icon: 'STK',
    group: 'Discover',
  },
  {
    key: 'Medicine',
    navLabel: 'Medicine',
    eyebrow: 'Care library',
    title: 'Medical reference that does not need a signal.',
    description:
      'Drug references, treatment steps, emergency guides and deeper textbooks, on your disk for the day you need an answer fast.',
    short: 'Drug references, treatment steps and emergency guides, on your disk.',
    icon: 'MED',
    group: 'Library',
  },
  {
    key: 'Survival & Preparedness',
    navLabel: 'Survival',
    eyebrow: 'Field guides',
    title: 'Plans, gear, food and bad weather.',
    description:
      'Video series, manuals and long reading for people who would rather keep the answer on disk than on a cell tower.',
    icon: 'SUR',
    group: 'Library',
  },
  {
    key: 'Education & Reference',
    navLabel: 'Education',
    eyebrow: 'Reference shelf',
    title: 'A small campus on your Mac.',
    description: 'Open textbooks, course bundles, tutorials and talks, shelved where you can find them again.',
    icon: 'EDU',
    group: 'Library',
  },
  {
    key: 'Science & Simulations',
    navLabel: 'Science',
    eyebrow: 'Lab shelf',
    title: 'Science for the curious machine.',
    description: 'Physics, astronomy, chemistry, biology and interactive simulations you can poke at offline.',
    icon: 'LAB',
    group: 'Library',
  },
  {
    key: 'Kids & Family',
    navLabel: 'Kids',
    eyebrow: 'Family shelf',
    title: 'Shelves for a machine other people use too.',
    description: 'Story collections, lighter encyclopedias and family reading.',
    icon: 'KID',
    group: 'Library',
  },
  {
    key: 'Open Courses & Lectures',
    navLabel: 'Courses',
    eyebrow: 'Course shelf',
    title: 'Lectures and open courses.',
    description:
      'Lecture libraries and structured study packs that install like apps, not like a folder of mystery videos.',
    icon: 'CRS',
    group: 'Library',
  },
  {
    key: 'Math & Problem Solving',
    navLabel: 'Math',
    eyebrow: 'Problem shelf',
    title: 'Proofs, drills and worked examples.',
    description: 'Math shelves from practice problems to advanced reference, for the long think.',
    icon: 'MTH',
    group: 'Library',
  },
  {
    key: 'Law, History & Society',
    navLabel: 'Society',
    eyebrow: 'Civic shelf',
    title: 'Law, history, philosophy and public life.',
    description: 'Context for institutions, policy and the old arguments that keep coming back.',
    icon: 'SOC',
    group: 'Library',
  },
  {
    key: 'Language & Writing',
    navLabel: 'Words',
    eyebrow: 'Language shelf',
    title: 'Writing, language and quotations.',
    description: 'Editing, reading, language learning and linguistics shelves for a machine that writes a lot.',
    icon: 'TXT',
    group: 'Library',
  },
  {
    key: 'DIY & Repair',
    navLabel: 'DIY',
    eyebrow: 'Repair shelf',
    title: 'Fix it yourself.',
    description: 'Repair guides, teardown notes and practical how-to for the workbench.',
    icon: 'FIX',
    group: 'Library',
  },
  {
    key: 'Maker & Electronics',
    navLabel: 'Maker',
    eyebrow: 'Bench shelf',
    title: 'Boards, parts and fabrication.',
    description: 'Electronics, 3D printing and hardware reference for people who solder, print or breadboard.',
    icon: 'PCB',
    group: 'Library',
  },
  {
    key: 'Agriculture & Food',
    navLabel: 'Agriculture',
    eyebrow: 'Grow and cook',
    title: 'Food, gardens and the pantry.',
    description: 'Cooking, food storage, gardening and homesteading reference you can use with dirt on your hands.',
    icon: 'GRW',
    group: 'Library',
  },
  {
    key: 'Homestead & Sustainability',
    navLabel: 'Homestead',
    eyebrow: 'Self-reliance',
    title: 'Energy, growing and building it yourself.',
    description: 'Longer-lived shelves for sustainability, field fixes and real-world making.',
    icon: 'HME',
    group: 'Library',
  },
  {
    key: 'Finance & Crypto',
    navLabel: 'Finance',
    eyebrow: 'Money shelf',
    title: 'Money reference, minus the influencer.',
    description: 'Investing, accounting, economics and crypto, grouped for research rather than hype.',
    icon: 'FIN',
    group: 'Library',
  },
  {
    key: 'Software Development',
    navLabel: 'Dev',
    eyebrow: 'Dev shelf',
    title: 'Docs that load when the Wi-Fi does not.',
    description: 'Language docs, framework references and engineering shelves for the RoachNet Dev workspace.',
    short: 'Language and framework docs that sit next to the editor.',
    icon: 'DEV',
    group: 'Library',
  },
  {
    key: 'Machine Learning & Data Science',
    navLabel: 'ML',
    eyebrow: 'ML shelf',
    title: 'Stats, data and model building.',
    description: 'Machine learning and data science reference, kept local like the models.',
    icon: 'ML',
    group: 'Library',
  },
  {
    key: 'Platforms & Systems',
    navLabel: 'Systems',
    eyebrow: 'Systems shelf',
    title: 'Operating systems and package managers.',
    description: 'Linux docs, package-manager lore, single-board computers and platform reference for the 1 AM session.',
    icon: 'SYS',
    group: 'Library',
  },
  {
    key: 'Security & Privacy',
    navLabel: 'Security',
    eyebrow: 'Defense shelf',
    title: 'Security reference for the machine you trust.',
    description: 'Threat models, Tor, defensive work and reverse engineering, readable without a tab staying open.',
    icon: 'SEC',
    group: 'Library',
  },
  {
    key: 'Music Production & Audio',
    navLabel: 'Audio',
    eyebrow: 'Audio craft',
    title: 'Theory and sound for studio days.',
    description: 'Music theory, production and audio talks that live next to the tools instead of somewhere in Downloads.',
    icon: 'AUD',
    group: 'Library',
  },
  {
    key: 'Design & Visual Media',
    navLabel: 'Design',
    eyebrow: 'Visual craft',
    title: 'Graphics, 3D and photography.',
    description: 'Blender, visual reference and production art shelves for the questions you only have mid-project.',
    icon: 'DES',
    group: 'Library',
  },
  {
    key: 'IT & Infrastructure',
    navLabel: 'Infra',
    eyebrow: 'Infra shelf',
    title: 'Networks, servers and operations.',
    description: 'Docs for operators and builders who expect the machine to keep working when the hosted tools do not.',
    icon: 'NET',
    group: 'Library',
  },
  {
    key: 'Travel & Field Guides',
    navLabel: 'Travel',
    eyebrow: 'Route shelf',
    title: 'City guides that work offline.',
    description: 'Travel guides and region notes that stay readable when the roaming data runs out.',
    icon: 'TRV',
    group: 'Library',
  },
  {
    key: 'Travel, Mobility & Outdoors',
    navLabel: 'Mobility',
    eyebrow: 'Move around',
    title: 'Outdoors, bikes and getting places.',
    description: 'Outdoor, cycling, aviation, expat and travel problem-solving shelves for life away from the desk.',
    icon: 'MOV',
    group: 'Library',
  },
  {
    key: 'Games, Film & Pop Culture',
    navLabel: 'Culture',
    eyebrow: 'Culture shelf',
    title: 'Film, games, anime and genre lore.',
    description: 'Pop-culture reference for trivia, worldbuilding and settling arguments.',
    icon: 'PLY',
    group: 'Library',
  },
  {
    key: 'Dictionaries & Primary Sources',
    navLabel: 'Library',
    eyebrow: 'Deep reference',
    title: 'Dictionaries and primary sources.',
    description: 'Wordbooks, source texts and very large public-domain archives, for when the vault should feel like a reading room.',
    icon: 'LIB',
    group: 'Library',
  },
  {
    key: 'Wikipedia',
    navLabel: 'Wikipedia',
    eyebrow: 'Quick reference',
    title: 'Wikipedia, in the size you pick.',
    description: 'From a quick-reference shelf to the full archive. Pick by how much disk you want to give it.',
    short: 'From a quick-reference shelf to the full archive. Pick by disk space.',
    icon: 'WIK',
    group: 'Library',
  },
  {
    key: 'Model Packs',
    navLabel: 'Models',
    eyebrow: 'RoachClaw models',
    title: 'Local models for RoachClaw.',
    description:
      'Starter, coding and general models that run on your Mac. A few still wait on the native engine; they say so, and their install button stays off.',
    short: 'Starter, coding and general models that run on your Mac.',
    icon: 'AI',
    group: 'RoachClaw',
  },
  {
    key: 'Feature Packs',
    navLabel: 'Packs',
    eyebrow: 'Settings › Packs',
    title: 'Feature packs for RoachNet 1.1.',
    description:
      'RoachNet 1.1 ships a core of about 31 MB and installs the rest on demand. Packs are checksum-verified, installed transactionally and removable without losing your data. They need 1.1, which is still in the workshop.',
    short: 'Pieces of RoachNet 1.1 you add when you want them. They need 1.1, which is still in the workshop.',
    rowEyebrow: 'New for 1.1',
    icon: 'PCK',
    group: 'RoachClaw',
  },
  {
    key: 'Voice Packs',
    navLabel: 'Voice',
    eyebrow: 'RoachSpeech packs',
    title: 'Voices and ears for RoachClaw.',
    description:
      'RoachVoice read-aloud, RoachWhisper transcription and voice cloning, each an optional install instead of surprise ballast.',
    icon: 'VOX',
    group: 'RoachClaw',
  },
]

const railGroups = [
  ['Discover', 'Discover'],
  ['Maps', 'Maps'],
  ['RoachClaw', 'RoachClaw and packs'],
  ['Library', 'Library'],
]

const sectionLookup = new Map(sectionDefinitions.map((section) => [section.key, section]))
const sectionSlugLookup = new Map(sectionDefinitions.map((section) => [slugify(section.navLabel), section.key]))

const todayFeaturedId = 'course-wikibooks_en_all_nopic'
const todayRows = [
  {
    eyebrow: 'Start here',
    title: 'Good first installs.',
    note: 'One ready-to-install pick from each corner of the store.',
    sections: [
      'Map Regions',
      'Map Picks',
      'Starter Stacks',
      'Medicine',
      'Open Courses & Lectures',
      'Science & Simulations',
      'Software Development',
      'Agriculture & Food',
      'Feature Packs',
      'Model Packs',
      'Voice Packs',
    ],
  },
  {
    eyebrow: 'Editors’ picks',
    title: 'Worth the disk space.',
    note: 'Study shelves, deep reference and RoachClaw picks for the second weekend.',
    sections: [
      'Math & Problem Solving',
      'Law, History & Society',
      'Security & Privacy',
      'Music Production & Audio',
      'Platforms & Systems',
      'Games, Film & Pop Culture',
      'Dictionaries & Primary Sources',
      'Wikipedia',
      'Model Packs',
      'Voice Packs',
    ],
  },
]
// Whole-section shelves on Today, each with a "See all" jump.
const todaySectionRows = [
  'Feature Packs',
  'Model Packs',
  'Voice Packs',
  'Medicine',
  'Software Development',
  'Starter Stacks',
  'Wikipedia',
  'Map Regions',
]
const searchSuggestions = ['python', 'medicine', 'wikipedia', 'voice', 'linux', 'math']

const itemCopy = {
  'course-wikibooks_en_all_nopic': {
    blurb:
      'Open textbooks for math, science, computing, languages, and more, all pulled into one clean study shelf.',
    detail: [
      'Good for brushing up on core subjects or wandering into something new at 2 AM without ending up in a maze of tabs.',
      'Wikibooks installs as its own RoachNet course app, so it shows up in Education as a single named library instead of a mess of separate files.',
    ],
  },
  'course-wikiversity_en_all_maxi': {
    blurb:
      'Community-built courses and tutorials that feel more like guided paths than isolated articles.',
    detail: [
      'Wikiversity is good when you want the “walk me through it” version instead of a dry reference page.',
      'It lands in Education as a distinct study shelf with tutorials, course outlines, and practice-oriented material.',
    ],
  },
  'course-ted_mul_ted-ed': {
    blurb:
      'Short, tightly-produced lessons on specific ideas, from black holes to literary devices and historical weirdness.',
    detail: [
      'TED-Ed is the quick-hit study shelf: concise explainers, clean pacing, and just enough polish to keep the learning shelf lively.',
      'It works well as a lightweight watch-later install inside the RoachNet vault.',
    ],
  },
  'course-openmusictheory.com_en_all': {
    blurb:
      'Harmony, notation, rhythm, and ear-training in one clean music-theory shelf.',
    detail: [
      'Open Music Theory is useful for production, arranging, scoring, and the occasional “wait, what chord am I actually hearing?” moment.',
      'It installs as a real course app in the audio/education shelf instead of hiding in a generic provider bundle.',
    ],
  },
  'base-atlas': {
    blurb:
      'Shared basemap and renderer assets that every regional map install stacks on top of.',
    detail: [
      'Base Atlas is the first thing to install if you want Maps to behave like a real offline atlas instead of a partial shelf.',
      'It provides the shared renderer and baseline assets so every regional pack opens cleanly inside RoachNet Maps.',
    ],
  },
  'map-pacific': {
    blurb:
      'A full Pacific rim atlas: West Coast city grids, mountain passes, shoreline routes, and the big empty stretches between them.',
  },
  'map-mountain': {
    blurb:
      'Mountain West coverage from ski towns and canyon roads to high-desert connectors and all the strange mileage in between.',
  },
  'map-west-south-central': {
    blurb:
      'Highways, farm roads, oilfield routes, and Gulf corridors across Arkansas, Oklahoma, Louisiana, and Texas.',
  },
  'map-east-south-central': {
    blurb:
      'Backroads, river crossings, and hill-country routes for four linked states that often share the same drives and supply chains.',
  },
  'map-south-atlantic': {
    blurb:
      'Coastal sprawl, hurricane corridors, and inland connectors running from Delaware down through Florida.',
  },
  'map-west-north-central': {
    blurb:
      'A classic flyover pack: grain routes, rail towns, river cities, and a lot of straight lines done properly.',
  },
  'map-east-north-central': {
    blurb:
      'Lake shoreline cities, industrial belts, and the connector towns that hold the middle of the region together.',
  },
  'map-mid-atlantic': {
    blurb:
      'Dense Northeast corridors, upstate routes, and the weird stuff between exits from New Jersey through Pennsylvania.',
  },
  'map-new-england': {
    blurb:
      'Coastal towns, mountain roads, and small-state border crossings from Connecticut up through northern Maine.',
  },
  'course-zimgit-medicine_en': {
    blurb:
      'Field and emergency medicine books and guides: trauma care, assessment checklists, treatment steps, and reference tables in one package.',
  },
  'course-nhs.uk_en_medicines': {
    blurb:
      'Drug monographs laid out clearly: what each medicine does, when it is used, typical doses, side effects, and interaction notes.',
  },
  'course-fas-military-medicine_en': {
    blurb:
      'Tactical and field-medicine manuals covering bleeding control, shock, prolonged care, and treatment in improvised settings.',
  },
  'course-wwwnc.cdc.gov_en_all': {
    blurb:
      'Plain-language CDC material on disease prevention, travel advisories, vaccinations, outbreaks, and basic public-health guidance.',
  },
  'course-medlineplus.gov_en_all': {
    blurb:
      'NIH reference on conditions, symptoms, procedures, drugs, supplements, and wellness topics in one encyclopedia-style shelf.',
  },
  'course-wikipedia_en_medicine_maxi': {
    blurb:
      'Picked-through Wikipedia medical articles with images kept where they actually help: conditions, anatomy, procedures, and pathologies.',
  },
  'course-libretexts.org_en_med': {
    blurb:
      'Course-style medical textbooks on systems, pathophysiology, diagnostics, and treatment chapters laid out like a proper curriculum.',
  },
  'course-librepathology_en_all_maxi': {
    blurb:
      'Microscopic findings, disease patterns, differential tables, and pathology case write-ups in one tight specialist shelf.',
  },
  'course-canadian_prepper_winterprepping_en': {
    blurb:
      'A focused cold-weather shelf for layering systems, shelter choices, heating, vehicle prep, and what realistically fails first in deep winter.',
  },
  'course-canadian_prepper_bugoutroll_en': {
    blurb:
      'A gear-first shelf for packs, pouches, rolls, and how to build a setup where everything has a clear job.',
  },
  'course-canadian_prepper_bugoutconcepts_en': {
    blurb:
      'The thinking half of bug-out planning: trigger points, route planning, staging, family plans, and what you leave behind.',
  },
  'course-urban-prepper_en_all': {
    blurb:
      'City-focused scenarios: outages, supply shocks, protests, elevators that stop, and how to navigate dense environments when systems stutter.',
  },
  'course-canadian_prepper_preppingfood_en': {
    blurb:
      'Storage methods, staple choices, rotation systems, and actual meal ideas built around prep, not restaurant cooking.',
  },
  'course-gutenberg_en_lcc-u': {
    blurb:
      'Doctrine-era texts on tactics, campaigns, field craft, and command; more how armies move and think than quote-poster military history.',
  },
  'course-libretexts.org_en_math': {
    blurb:
      'A full math sequence in one shelf: algebra, trig, calculus, linear algebra, stats, and more, laid out like a real course track.',
  },
  'course-libretexts.org_en_phys': {
    blurb:
      'Mechanics, E&M, thermodynamics, and modern physics in lecture-style chapters with worked examples and problems.',
  },
  'course-libretexts.org_en_chem': {
    blurb:
      'General chemistry through organic and beyond: reactions, lab skills, problem sets, and exam-style questions.',
  },
  'course-libretexts.org_en_bio': {
    blurb:
      'Cell bio, genetics, ecology, human systems, and more for both formal study and “I actually want to understand this” reading.',
  },
  'course-wikibooks_en_all_maxi': {
    blurb:
      'The image-rich Wikibooks shelf, keeping diagrams, figures, and illustrations where they actually teach something.',
  },
  'course-ted_mul_ted-conference': {
    blurb:
      'Flagship TED talks across science, design, policy, culture, and human stories; a good ideas shelf for background watching.',
  },
  'course-libretexts.org_en_human': {
    blurb:
      'Literature, philosophy, history, political science, and sociology collections so the humanities are not an afterthought on a dev machine.',
  },
  'course-libretexts.org_en_geo': {
    blurb:
      'Earth systems, rocks, climate, natural hazards, and environmental impact in textbook-level detail.',
  },
  'course-libretexts.org_en_eng': {
    blurb:
      'Statics, circuits, fluids, materials, and other engineering fundamentals organized like a proper program track.',
  },
  'course-libretexts.org_en_business': {
    blurb:
      'Accounting, management, marketing, finance, and entrepreneurship texts useful for running a label, studio, or any small independent shop.',
  },
}

const root = document.documentElement
const sidebarNav = document.querySelector('#apps-sidebar-nav')
const sectionHead = document.querySelector('#apps-section-head')
const storeStage = document.querySelector('#apps-store-stage')
const storeContent = document.querySelector('.st-content')
const storeRail = document.querySelector('.st-rail')
const searchInput = document.querySelector('#apps-search')
const primaryDownloadButton = document.querySelector('#apps-primary-download')
const downloadMeta = document.querySelector('#apps-download-meta')
const detailOverlay = document.querySelector('#apps-detail-overlay')
const detailContent = document.querySelector('#apps-detail-content')
const detailClose = document.querySelector('#apps-detail-close')
const connectivityNode = document.querySelector('[data-store-connectivity]')
const totalNodes = [...document.querySelectorAll('[data-store-total]')]
const liveRegion = document.querySelector('#apps-live')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(pointer: fine)')
const compactLayout = window.matchMedia('(max-width: 1023px)')
const motionOK = () => !reducedMotion.matches

const state = {
  catalog: null,
  items: [],
  activeSection: resolveInitialSection(),
  query: '',
}

let detailTrigger = null
let detailClosing = false
let detailCloseTimer = null
let uid = 0
let renderQueued = false
let animateNextRender = true
let toastNode = null
let toastTimer = null

/* ---------------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------------ */

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function nextId(prefix) {
  uid += 1
  return `${prefix}-${uid}`
}

function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`
}

function shortVersion(version) {
  return String(version || '').replace(/\.0$/, '')
}

function sizeToBytes(size) {
  const match = /([\d.]+)\s*(B|KB|MB|GB|TB)\b/i.exec(String(size || ''))
  if (!match) return 0
  const power = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }[match[2].toUpperCase()]
  return Number.parseFloat(match[1]) * 1024 ** power
}

function formatCompactBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function safeHref(url) {
  const value = String(url || '')
  if (/^https:\/\//i.test(value) || /^\.\//.test(value) || /^\/[^/]/.test(value)) return value
  return ''
}

function resolveInitialSection() {
  const hash = window.location.hash.replace(/^#/, '')
  return sectionSlugLookup.get(hash) || 'Today'
}

function announce(message) {
  if (!liveRegion) return
  liveRegion.textContent = ''
  window.setTimeout(() => {
    liveRegion.textContent = message
  }, 40)
}

function showToast(message) {
  if (!toastNode) {
    toastNode = document.createElement('div')
    toastNode.className = 'nx-toast'
    toastNode.setAttribute('role', 'status')
    toastNode.setAttribute('aria-live', 'polite')
    document.body.append(toastNode)
  }
  toastNode.textContent = message
  toastNode.classList.add('is-on')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastNode.classList.remove('is-on'), 2200)
}

/* ---------------------------------------------------------------------------
   Download + status
   ------------------------------------------------------------------------ */

function setDownloadButton() {
  if (!primaryDownloadButton) return
  const asset = hostedDownloads.mac
  primaryDownloadButton.setAttribute('href', asset.url)
  primaryDownloadButton.textContent = `Download RoachNet ${asset.version} for macOS`
  // The size line in the HTML describes 1.0.6. If the site config moves on,
  // say less rather than something stale.
  if (downloadMeta && asset.version !== '1.0.6') {
    downloadMeta.textContent = `v${asset.version} · Apple Silicon · ad-hoc signed, not Apple-notarized`
  }
}

function updateConnectivity() {
  if (!connectivityNode) return
  const isOnline = navigator.onLine
  connectivityNode.dataset.state = isOnline ? 'online' : 'offline'
  connectivityNode.textContent = isOnline ? 'Online. Installs can start right away.' : 'You are offline. Installs need a connection to download.'
}

function startTelemetry() {
  updateConnectivity()
  window.addEventListener('online', updateConnectivity)
  window.addEventListener('offline', updateConnectivity)
}

/* ---------------------------------------------------------------------------
   Install contract (do not change the URL shape: the native app parses it)
   ------------------------------------------------------------------------ */

function buildInstallUrl(item) {
  if (!item?.installIntent) return ''

  const params = new URLSearchParams()
  const installMetadata = {
    id: item.id,
    title: item.title,
    category: item.section || item.category,
  }

  Object.entries(installMetadata).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value)
    }
  })

  Object.entries(item.installIntent).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value)
    }
  })

  const query = params.toString()
  return query ? `roachnet://install-content?${query}` : 'roachnet://install-content'
}

function attemptNativeInstall(url) {
  if (!url) return

  let completed = false
  let fallbackTimer = null

  const clearFallback = () => {
    completed = true
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', clearFallback)
    window.removeEventListener('blur', handleBlur)
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      clearFallback()
    }
  }

  const handleBlur = () => {
    window.setTimeout(() => {
      if (document.visibilityState === 'hidden') {
        clearFallback()
      }
    }, 120)
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', clearFallback)
  window.addEventListener('blur', handleBlur)

  fallbackTimer = window.setTimeout(() => {
    if (completed) return
    clearFallback()
    window.location.href = 'https://roachnet.org/#downloads'
  }, 1400)

  window.location.href = url
}

/* ---------------------------------------------------------------------------
   Catalog model
   ------------------------------------------------------------------------ */

function getArtifactLabel(item) {
  const artifact = item.artifact || {}

  if (artifact.provider === 'Apps.RoachNet.org') {
    if (artifact.status === 'published' || artifact.status === 'descriptor-backed') {
      return 'Apps descriptor'
    }
    if (artifact.status === 'manifest-backed') {
      return 'Catalog manifest'
    }
    return 'Source descriptor'
  }

  if (artifact.status === 'runtime-pull') {
    return 'Runtime pull'
  }

  return 'Catalog handoff'
}

// Where an install shows up inside RoachNet, by install action.
function landingFor(item, section) {
  const action = item.installIntent?.action
  switch (action) {
    case 'base-map-assets':
    case 'map-collection':
      return { place: 'Maps', note: 'Goes straight into RoachNet Maps and opens without a connection.' }
    case 'direct-download':
      return item.installIntent?.filetype === 'map'
        ? { place: 'Maps', note: 'One map file, filed into RoachNet Maps.' }
        : { place: 'Downloads lane', note: 'Fetched by RoachNet from the descriptor and filed with your other installs.' }
    case 'education-tier':
      return { place: 'A shelf per pack', note: 'One install queues every shelf in the stack. Each one keeps its own name.' }
    case 'education-resource':
      return { place: `${section.navLabel} shelf`, note: 'Lands as its own named shelf you can read offline.' }
    case 'wikipedia-option':
      return { place: 'Wikipedia', note: 'Queued straight into the RoachNet Wikipedia lane.' }
    case 'roachclaw-model':
      return { place: 'RoachClaw', note: 'Joins the RoachClaw model list and runs on your Mac.' }
    case 'roachspeech-pack':
      return { place: 'RoachSpeech', note: 'Adds a voice or a listener to RoachSpeech, on your Mac.' }
    case 'pack':
      return {
        place: 'Settings › Packs',
        note: 'The Pack Manager checks the published SHA-256 before anything is unpacked. Remove keeps your data unless you say otherwise.',
      }
    default:
      return { place: section.navLabel, note: 'Filed with the rest of your RoachNet installs.' }
  }
}

function buildFallbackBlurb(item) {
  const subtitle = String(item.subtitle || '').trim()
  const summary = String(item.summary || '').trim()

  if (subtitle && subtitle.length <= 140) {
    return subtitle.replace(/\.$/, '')
  }
  if (summary) {
    const firstSentence = summary.split(/(?<=[.!?])\s+/)[0]?.trim()
    if (firstSentence) return firstSentence.replace(/\.$/, '')
  }
  return item.title
}

function itemState(item) {
  if (!item.availability?.reason) return 'ready'
  return item.availability.state === 'unsupported' ? 'unsupported' : 'unavailable'
}

function enrichItem(item, index) {
  const copy = itemCopy[item.id] || {}
  const section = sectionLookup.get(item.section) || sectionLookup.get('Today')
  const blurb = copy.blurb || buildFallbackBlurb(item)
  const detail = copy.detail || [item.summary].filter(Boolean)
  const tier = ['Essential', 'Standard', 'Comprehensive'].includes(item.category) ? item.category : ''
  const artifactLabel = getArtifactLabel(item)

  return {
    ...item,
    index,
    sectionMeta: section,
    blurb,
    detail,
    tier,
    state: itemState(item),
    minimum: item.minimumRoachNet ? shortVersion(item.minimumRoachNet) : '',
    bytes: Number(item.sizeBytes) || Number(item.artifact?.bytes) || sizeToBytes(item.size),
    installUrl: buildInstallUrl(item),
    artifactLabel,
    landing: landingFor(item, section),
    titleKey: normalizeValue(item.title),
    haystack: normalizeValue([
      item.title,
      item.subtitle,
      item.category,
      item.section,
      section.navLabel,
      item.status,
      item.source,
      item.summary,
      blurb,
      item.machineFit,
      artifactLabel,
      item.artifact?.provider,
      item.artifact?.key,
      item.installIntent?.artifactKey,
      item.installIntent?.model,
      item.installIntent?.pack,
      ...(item.includes || []),
      ...detail,
    ].join(' ')),
  }
}

function findItemById(id) {
  return state.items.find((item) => item.id === id)
}

function searchItems(items, query) {
  const normalized = normalizeValue(query)
  if (!normalized) return items
  const terms = normalized.split(' ').filter(Boolean)

  return items
    .map((item) => {
      if (!terms.every((term) => item.haystack.includes(term))) return null
      let score = 3
      if (item.titleKey.startsWith(normalized)) score = 0
      else if (item.titleKey.includes(normalized)) score = 1
      else if (terms.every((term) => item.titleKey.includes(term))) score = 2
      return { item, score }
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.item.index - b.item.index)
    .map(({ item }) => item)
}

function itemsInSection(sectionKey, items = state.items) {
  return sectionKey === 'Today' ? items : items.filter((item) => item.section === sectionKey)
}

function readyFirst(items) {
  return [...items].sort((a, b) => (a.state === 'ready' ? 0 : 1) - (b.state === 'ready' ? 0 : 1) || a.index - b.index)
}

function bySections(sectionKeys, limit = sectionKeys.length) {
  const picks = []
  const seen = new Set()

  for (const section of sectionKeys) {
    const candidate = itemsInSection(section).find((item) => {
      if (seen.has(item.id)) return false
      // Shelf rows are install suggestions; an item whose source is
      // withdrawn or unsupported still shows in its section, not here.
      if (item.availability) return false
      return item.id !== todayFeaturedId
    })

    if (!candidate) continue
    seen.add(candidate.id)
    picks.push(candidate)
    if (picks.length >= limit) break
  }

  return picks
}

/* ---------------------------------------------------------------------------
   Markup
   ------------------------------------------------------------------------ */

function renderIcon(item, size = 'card') {
  const mono = item.iconMonogram || String(item.title || 'RN').slice(0, 3).toUpperCase()
  const eager = size !== 'card'
  return `
    <span class="st-icon st-icon--${size}" data-accent="${escapeHtml(item.accent || 'blue')}" aria-hidden="true">
      <span class="st-icon__mono">${escapeHtml(mono)}</span>
      ${item.iconAsset ? `<img class="st-icon__art" src="${escapeHtml(item.iconAsset)}" alt="" width="512" height="512" ${eager ? '' : 'loading="lazy" '}decoding="async" />` : ''}
    </span>
  `
}

function stateLabel(item) {
  if (item.state === 'unsupported') return 'Not supported yet'
  if (item.state === 'unavailable') return 'Temporarily unavailable'
  return ''
}

function renderBadges(item, { withTier = true } = {}) {
  const badges = []
  if (item.size) badges.push(`<li class="st-badge st-badge--size">${escapeHtml(item.size)}</li>`)
  if (withTier && item.tier) badges.push(`<li class="st-badge">${escapeHtml(item.tier)}</li>`)
  if (item.minimum) badges.push(`<li class="st-badge st-badge--needs">Needs ${escapeHtml(item.minimum)}</li>`)
  return badges.length ? `<ul class="st-badges">${badges.join('')}</ul>` : ''
}

/** The install button, or an honest "not right now" when the source is down or the engine can't run it. */
function renderInstallControl(item, variant = 'card') {
  if (item.availability?.reason) {
    const whyId = nextId('apps-why')
    return `
      <div class="st-install-wrap" data-state="${item.state}">
        <button class="st-install st-install--off st-install--${variant}" type="button" disabled aria-describedby="${whyId}">${stateLabel(item)}</button>
        <p class="st-why" id="${whyId}">${escapeHtml(item.availability.reason)}</p>
      </div>
    `
  }
  if (!item.installUrl) return ''
  const minimum = item.minimumRoachNet ? ` (RoachNet ${item.minimumRoachNet}+)` : ''
  const label = variant === 'card' ? 'Install' : item.installLabel || 'Install to RoachNet'
  return `
    <a class="st-install st-install--${variant}" href="${escapeHtml(item.installUrl)}" data-install-title="${escapeHtml(item.title)}" aria-label="${escapeHtml(`Install ${item.title} to RoachNet${minimum}`)}">
      <span class="st-install__label">${escapeHtml(label)}</span>
      <span class="st-install__busy" aria-hidden="true">Opening RoachNet</span>
    </a>
  `
}

function renderCard(item, { kicker = 'section' } = {}) {
  const kickerText = kicker === 'status' ? item.status || item.sectionMeta.navLabel : item.sectionMeta.navLabel
  return `
    <article class="apps-card st-card" data-accent="${escapeHtml(item.accent || 'blue')}" data-state="${item.state}">
      <div class="st-card__top">
        ${renderIcon(item, 'card')}
        <div class="st-card__id">
          <p class="st-card__kicker">${escapeHtml(kickerText)}</p>
          <h3 class="st-card__title">
            <button class="st-card__open" type="button" data-preview-id="${escapeHtml(item.id)}" aria-haspopup="dialog">${escapeHtml(item.title)}</button>
          </h3>
        </div>
      </div>
      <p class="st-card__blurb">${escapeHtml(item.blurb)}</p>
      ${renderBadges(item)}
      <div class="st-card__foot">${renderInstallControl(item, 'card')}</div>
    </article>
  `
}

function renderHero(item) {
  if (!item) return ''
  const body = item.detail?.[0] && item.detail[0] !== item.blurb ? item.detail[0] : item.summary || ''
  const topics = (item.includes || []).filter((entry) => !/^version\s/i.test(entry)).slice(0, 3)
  return `
    <section class="apps-preview-stage apps-hero-panel st-hero" data-accent="${escapeHtml(item.accent || 'blue')}" aria-labelledby="apps-hero-title">
      <div class="st-hero__copy">
        <p class="nx-overline">Today’s pick</p>
        <h2 class="st-hero__title" id="apps-hero-title">${escapeHtml(item.title)}</h2>
        <p class="st-hero__lead">${escapeHtml(item.blurb)}</p>
        ${body ? `<p class="st-hero__body">${escapeHtml(body)}</p>` : ''}
        <div class="st-hero__actions">
          ${renderInstallControl(item, 'hero')}
          <button class="nx-btn st-hero__more" type="button" data-preview-id="${escapeHtml(item.id)}" aria-haspopup="dialog">See what is inside</button>
        </div>
      </div>
      <div class="st-hero__art">
        ${renderIcon(item, 'hero')}
        ${topics.length ? `<ul class="st-hero__topics">${topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join('')}</ul>` : ''}
      </div>
      <dl class="apps-hero-panel__strip st-hero__strip">
        <div><dt>Shelf</dt><dd>${escapeHtml(item.sectionMeta.navLabel)}</dd></div>
        <div><dt>Size</dt><dd>${escapeHtml(item.size || 'Varies')}</dd></div>
        <div><dt>Lands in</dt><dd>${escapeHtml(item.landing.place)}</dd></div>
      </dl>
    </section>
  `
}

const chevron = (direction) =>
  `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${direction < 0 ? 'm12 4-6 6 6 6' : 'm8 4 6 6-6 6'}"></path></svg>`

function renderShelfRow({ eyebrow, title, note, items, section = null, total = 0, flag = '' }) {
  if (!items.length) return ''
  const rowId = nextId('apps-row')
  const titleId = `${rowId}-title`
  const seeAll = section
    ? `<a class="st-row__all" href="#${slugify(section.navLabel)}" data-section="${escapeHtml(section.key)}">See all ${total}<span class="nx-sr"> in ${escapeHtml(section.navLabel)}</span></a>`
    : ''
  return `
    <section class="apps-row st-row" aria-labelledby="${titleId}">
      <div class="st-row__head">
        <div class="st-row__copy">
          <p class="st-row__eyebrow">${escapeHtml(eyebrow)}${flag ? ` <span class="st-flag">${escapeHtml(flag)}</span>` : ''}</p>
          <h2 class="st-row__title" id="${titleId}">${escapeHtml(title)}</h2>
          ${note ? `<p class="st-row__note">${escapeHtml(note)}</p>` : ''}
        </div>
        <div class="st-row__tools">
          ${seeAll}
          <button class="st-arrow" type="button" data-row-scroll="-1" aria-controls="${rowId}" aria-label="Scroll ${escapeHtml(title.replace(/\.$/, ''))} back">${chevron(-1)}</button>
          <button class="st-arrow" type="button" data-row-scroll="1" aria-controls="${rowId}" aria-label="Scroll ${escapeHtml(title.replace(/\.$/, ''))} forward">${chevron(1)}</button>
        </div>
      </div>
      <div class="apps-row__scroller st-row__scroller" id="${rowId}" tabindex="0" role="region" aria-label="${escapeHtml(title.replace(/\.$/, ''))}">
        ${items.map((item) => renderCard(item)).join('')}
      </div>
    </section>
  `
}

function renderTodayView() {
  const featured = findItemById(todayFeaturedId) || state.items.find((item) => item.state === 'ready')
  const pickRows = todayRows.map((row) => renderShelfRow({ ...row, items: bySections(row.sections) }))
  const sectionRows = todaySectionRows.map((key) => {
    const section = sectionLookup.get(key)
    const all = itemsInSection(key)
    if (!section || !all.length) return ''
    const allOff = all.every((item) => item.state !== 'ready')
    return renderShelfRow({
      eyebrow: section.rowEyebrow || section.eyebrow,
      title: section.title,
      note: section.short || section.description,
      items: readyFirst(all).slice(0, 10),
      section,
      total: all.length,
      flag: allOff ? 'Temporarily unavailable' : '',
    })
  })

  renderSectionHead('')
  storeStage.innerHTML = `
    ${renderHero(featured)}
    ${pickRows[0] || ''}
    ${sectionRows.slice(0, 3).join('')}
    ${pickRows[1] || ''}
    ${sectionRows.slice(3).join('')}
  `
}

function renderSectionHead(content = '') {
  if (!sectionHead) return
  if (!content) {
    sectionHead.hidden = true
    sectionHead.innerHTML = ''
    return
  }
  sectionHead.hidden = false
  sectionHead.innerHTML = content
}

function renderAvailabilityNotice(items) {
  const off = items.filter((item) => item.state !== 'ready')
  if (!off.length) return ''
  const reasons = [...new Set(off.map((item) => item.availability.reason))]
  const tone = off.every((item) => item.state === 'unsupported') ? 'unsupported' : 'unavailable'
  const lead = off.length === items.length
    ? tone === 'unsupported' ? 'None of these run yet.' : 'This whole shelf is on a short break.'
    : tone === 'unsupported'
      ? `${plural(off.length, 'item')} here cannot run yet.`
      : `${plural(off.length, 'item')} here ${off.length === 1 ? 'is' : 'are'} temporarily unavailable.`
  const reasonText = reasons.length === 1 ? reasons[0] : 'Each one says why on its card.'
  return `
    <div class="st-notice" data-state="${tone}" role="note">
      <span class="st-notice__icon" aria-hidden="true">${tone === 'unsupported' ? '×' : '!'}</span>
      <p><strong>${escapeHtml(lead)}</strong> ${escapeHtml(reasonText)}</p>
    </div>
  `
}

function renderEmptyState(query, sectionKey) {
  const elsewhere = sectionKey !== 'Today' ? searchItems(state.items, query).length : 0
  const section = sectionLookup.get(sectionKey)
  return `
    <section class="st-empty" aria-labelledby="apps-empty-title">
      <span class="st-empty__art" aria-hidden="true"><span>0</span></span>
      <h2 class="st-empty__title" id="apps-empty-title">Nothing on ${sectionKey === 'Today' ? 'the shelves' : `the ${escapeHtml(section?.navLabel || '')} shelf`} called “${escapeHtml(query)}”.</h2>
      <p class="st-empty__body">${elsewhere ? `There ${elsewhere === 1 ? 'is' : 'are'} ${plural(elsewhere, 'match', 'matches')} in other sections, though.` : 'Try one word, or a topic. These usually turn something up:'}</p>
      <div class="st-empty__actions">
        ${elsewhere ? `<button class="nx-btn nx-btn--primary nx-btn--sm" type="button" data-section="Today">Search every section</button>` : searchSuggestions.map((word) => `<button class="nx-chip st-suggest" type="button" data-search-suggest="${word}">${word}</button>`).join('')}
        <button class="nx-btn nx-btn--sm" type="button" data-clear-search>Clear search</button>
      </div>
    </section>
  `
}

function renderListView() {
  const section = sectionLookup.get(state.activeSection) || sectionLookup.get('Today')
  const query = state.query.trim()
  const scoped = itemsInSection(section.key)
  const items = query ? searchItems(scoped, query) : scoped
  const totalBytes = items.reduce((sum, item) => sum + (item.bytes || 0), 0)

  if (query && !items.length) {
    // The empty state carries its own heading; a "No results" head on top
    // would just say it twice.
    renderSectionHead('')
  } else if (query) {
    const where = section.key === 'Today' ? 'across the store' : `in ${section.navLabel}`
    renderSectionHead(`
      <div class="st-section-head__copy">
        <p class="nx-overline nx-overline--cyan">Search</p>
        <h2 class="st-section-head__title">${items.length ? `${plural(items.length, 'result')} for “${escapeHtml(query)}”` : 'No results'}</h2>
        <p class="st-section-head__lede">${items.length ? `Best title matches first, ${escapeHtml(where)}.` : `Nothing matched ${escapeHtml(where)}.`}</p>
      </div>
      <div class="st-section-head__meta">
        ${section.key !== 'Today' ? `<button class="nx-chip" type="button" data-section="Today">Search every section</button>` : ''}
        <button class="nx-chip" type="button" data-clear-search>Clear search</button>
      </div>
    `)
  } else {
    renderSectionHead(`
      <div class="st-section-head__copy">
        <p class="nx-overline">${escapeHtml(section.eyebrow)}</p>
        <h2 class="st-section-head__title">${escapeHtml(section.title)}</h2>
        <p class="st-section-head__lede">${escapeHtml(section.description)}</p>
      </div>
      <ul class="st-section-head__meta st-stats">
        <li><strong>${items.length}</strong><span>${items.length === 1 ? 'install' : 'installs'}</span></li>
        ${totalBytes ? `<li><strong>${escapeHtml(formatCompactBytes(totalBytes))}</strong><span>if you take the lot</span></li>` : ''}
      </ul>
      ${renderAvailabilityNotice(items)}
    `)
  }

  if (!items.length) {
    storeStage.innerHTML = renderEmptyState(query, section.key)
    return
  }

  storeStage.innerHTML = `
    <div class="apps-card-grid st-grid">
      ${(query ? items : readyFirst(items)).map((item) => renderCard(item, { kicker: query || section.key === 'Today' ? 'section' : 'status' })).join('')}
    </div>
  `
}

/* ---------------------------------------------------------------------------
   Rail (built once, then updated in place so focus survives)
   ------------------------------------------------------------------------ */

function buildRail() {
  if (!sidebarNav) return
  const groups = railGroups
    .map(([group, label]) => {
      const sections = sectionDefinitions.filter((section) => section.group === group)
      return `
        <p class="st-rail__group">${escapeHtml(label)}</p>
        ${sections
          .map(
            (section) => `
              <a class="st-rail__item" href="#${slugify(section.navLabel)}" data-section="${escapeHtml(section.key)}">
                <span class="st-rail__code" aria-hidden="true">${escapeHtml(section.icon)}</span>
                <span class="st-rail__label">${escapeHtml(section.navLabel)}</span>
                <span class="st-rail__count"><span class="nx-sr">, </span><span data-rail-count>0</span><span class="nx-sr"> installs</span></span>
              </a>
            `
          )
          .join('')}
      `
    })
    .join('')
  sidebarNav.innerHTML = groups
}

function updateRail() {
  if (!sidebarNav) return
  const query = state.query.trim()
  const pool = query ? searchItems(state.items, query) : state.items
  const counts = pool.reduce((map, item) => map.set(item.section, (map.get(item.section) || 0) + 1), new Map())
  let active = null

  sidebarNav.querySelectorAll('[data-section]').forEach((link) => {
    const key = link.dataset.section
    const count = key === 'Today' ? pool.length : counts.get(key) || 0
    const isActive = key === state.activeSection
    const countNode = link.querySelector('[data-rail-count]')
    if (countNode) countNode.textContent = String(count)
    link.classList.toggle('is-active', isActive)
    link.classList.toggle('is-empty', Boolean(query) && count === 0)
    if (isActive) {
      link.setAttribute('aria-current', 'page')
      active = link
    } else {
      link.removeAttribute('aria-current')
    }
  })
  sidebarNav.classList.toggle('is-searching', Boolean(query))
  keepRailItemInView(active)
}

function keepRailItemInView(link) {
  if (!link || !sidebarNav) return
  const nav = sidebarNav
  if (compactLayout.matches) {
    const left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2
    nav.scrollTo({ left: Math.max(0, left), behavior: motionOK() ? 'smooth' : 'auto' })
    return
  }
  const top = link.offsetTop
  const bottom = top + link.offsetHeight
  if (top < nav.scrollTop + 8 || bottom > nav.scrollTop + nav.clientHeight - 8) {
    nav.scrollTo({ top: Math.max(0, top - nav.clientHeight / 2), behavior: motionOK() ? 'smooth' : 'auto' })
  }
}

/* ---------------------------------------------------------------------------
   Render loop
   ------------------------------------------------------------------------ */

function renderStore() {
  if (!state.catalog || !storeStage) return
  updateRail()

  if (state.activeSection === 'Today' && !state.query.trim()) {
    renderTodayView()
  } else {
    renderListView()
  }

  storeStage.setAttribute('aria-busy', 'false')
  bindShelfScrollers()
  staggerCards()
}

function queueRender({ animate = false } = {}) {
  animateNextRender = animateNextRender || animate
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    renderStore()
  })
}

function staggerCards() {
  const animate = animateNextRender && motionOK()
  animateNextRender = false
  // The stagger delay comes from :nth-child rules in nx-store.css, so no
  // per-card style is written.
  storeStage.classList.toggle('st-stage--enter', animate)
  if (!animate) return
  window.setTimeout(() => storeStage.classList.remove('st-stage--enter'), 1400)
}

function syncArrows(scroller) {
  const row = scroller.closest('.st-row')
  if (!row) return
  const max = scroller.scrollWidth - scroller.clientWidth - 2
  const back = row.querySelector('[data-row-scroll="-1"]')
  const forward = row.querySelector('[data-row-scroll="1"]')
  if (back) back.disabled = scroller.scrollLeft <= 2
  if (forward) forward.disabled = scroller.scrollLeft >= max
  row.classList.toggle('is-scrollable', max > 0)
}

function bindShelfScrollers() {
  storeStage.querySelectorAll('.st-row__scroller').forEach((scroller) => {
    syncArrows(scroller)
    scroller.addEventListener('scroll', () => syncArrows(scroller), { passive: true })
    scroller.addEventListener('keydown', (event) => {
      if (event.target !== scroller || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      event.preventDefault()
      scrollRow(scroller, event.key === 'ArrowRight' ? 1 : -1)
    })
  })
}

function scrollRow(scroller, direction) {
  const card = scroller.querySelector('.st-card')
  const step = card ? card.getBoundingClientRect().width + 16 : 300
  const visible = Math.max(1, Math.floor(scroller.clientWidth / step))
  scroller.scrollBy({ left: direction * step * visible, behavior: motionOK() ? 'smooth' : 'auto' })
}

function scrollToContent({ force = false } = {}) {
  const target = storeContent || storeStage
  if (!target) return
  const nav = document.querySelector('.nx-nav')
  let offset = (nav?.getBoundingClientRect().bottom || 0) + 16
  if (compactLayout.matches && storeRail) offset += storeRail.getBoundingClientRect().height + 4
  const top = target.getBoundingClientRect().top + window.scrollY - offset
  if (window.scrollY > top + 4 || (force && Math.abs(window.scrollY - top) > 4)) {
    window.scrollTo({ top: Math.max(0, top), behavior: force || !motionOK() ? 'auto' : 'smooth' })
  }
}

function setActiveSection(sectionKey, { push = true } = {}) {
  if (!sectionLookup.has(sectionKey)) sectionKey = 'Today'
  state.activeSection = sectionKey
  if (push) {
    if (sectionKey !== 'Today') {
      const slug = slugify(sectionLookup.get(sectionKey)?.navLabel || sectionKey)
      if (window.location.hash !== `#${slug}`) window.location.hash = slug
    } else if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search)
    }
  }
  animateNextRender = true
  renderStore()
  requestAnimationFrame(scrollToContent)
}

function setQuery(value, { focus = false } = {}) {
  state.query = value
  if (searchInput && searchInput.value !== value) searchInput.value = value
  renderStore()
  announceResults()
  if (focus) searchInput?.focus()
}

let announceTimer = null
function announceResults() {
  window.clearTimeout(announceTimer)
  const query = state.query.trim()
  if (!query) return
  announceTimer = window.setTimeout(() => {
    const scoped = itemsInSection(state.activeSection)
    const count = searchItems(scoped, query).length
    announce(count ? `${plural(count, 'result')} for ${query}.` : `No results for ${query}.`)
  }, 420)
}

/* ---------------------------------------------------------------------------
   Detail sheet
   ------------------------------------------------------------------------ */

function factRow(label, value, { href = '', mono = false } = {}) {
  if (!value) return ''
  const link = safeHref(href)
  const external = /^https:\/\//i.test(link)
  const body = link
    ? `<a class="st-facts__link" href="${escapeHtml(link)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${escapeHtml(value)}</a>`
    : escapeHtml(value)
  return `<div><dt>${escapeHtml(label)}</dt><dd${mono ? ' class="st-mono"' : ''}>${body}</dd></div>`
}

function renderDetail(item) {
  const artifact = item.artifact || {}
  const artifactUrl = artifact.url || item.installIntent?.mirrorUrl || item.installIntent?.url || ''
  const detailHref = safeHref(item.detailUrl || item.primaryUrl)
  const includes = item.includes?.length ? item.includes : ['Direct native install handoff into the right RoachNet section.']
  // Unavailable / unsupported items explain themselves next to the disabled
  // install control; the notice is only for the 1.1 requirement.
  const notice = item.state === 'ready' && item.minimum
      ? `<div class="st-notice" data-state="needs" role="note"><span class="st-notice__icon" aria-hidden="true">${escapeHtml(item.minimum)}</span><p><strong>Needs RoachNet ${escapeHtml(item.minimum)} or later.</strong> 1.1 is still in the workshop, so this one waits until you are on it.</p></div>`
      : ''

  return `
    <article class="apps-detail st-detail" data-accent="${escapeHtml(item.accent || 'blue')}">
      <header class="st-detail__hero">
        ${renderIcon(item, 'detail')}
        <div class="st-detail__id">
          <p class="nx-overline">${escapeHtml(item.sectionMeta.navLabel)}</p>
          <h2 class="st-detail__title" id="apps-detail-title">${escapeHtml(item.title)}</h2>
          <p class="st-detail__sub">${escapeHtml(item.subtitle || item.source || item.section)}</p>
          ${renderBadges(item)}
        </div>
      </header>

      ${notice}

      <div class="st-detail__actions">
        ${renderInstallControl(item, 'sheet')}
        <button class="nx-btn st-copy" type="button" data-copy-link="${escapeHtml(item.id)}">
          <span class="st-copy__label">Copy link</span>
        </button>
        ${detailHref ? `<a class="nx-link nx-link--arrow" href="${escapeHtml(detailHref)}"${/^https:/.test(detailHref) ? ' target="_blank" rel="noreferrer"' : ''}>${escapeHtml(item.detailLabel || 'Open manifest')}</a>` : ''}
      </div>

      <div class="st-detail__grid">
        <section class="st-detail__story" aria-labelledby="apps-detail-inside">
          <h3 class="st-detail__h" id="apps-detail-inside">What’s inside</h3>
          ${item.detail.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          <ul class="st-ticks">
            ${includes.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}
          </ul>
        </section>

        <section class="st-land" aria-labelledby="apps-detail-land">
          <h3 class="st-detail__h" id="apps-detail-land">Where it lands</h3>
          <p class="st-land__path"><span>RoachNet</span><span aria-hidden="true">›</span><strong>${escapeHtml(item.landing.place)}</strong></p>
          <p class="st-land__note">${escapeHtml(item.landing.note)}</p>
          <p class="st-land__note">On disk it lives under <code>~/RoachNet</code>, with everything else.</p>
          ${item.machineFit ? `<p class="st-land__fit"><span>Fits</span>${escapeHtml(item.machineFit)}</p>` : ''}
        </section>
      </div>

      <section class="st-facts" aria-labelledby="apps-detail-facts">
        <h3 class="st-detail__h" id="apps-detail-facts">Install facts</h3>
        <dl>
          ${factRow('Size', item.size || 'Unknown')}
          ${factRow('Shelf', item.section)}
          ${factRow('Status', item.status)}
          ${factRow('Tier', item.tier)}
          ${factRow('Needs', item.minimumRoachNet ? `RoachNet ${item.minimumRoachNet} or later` : '')}
          ${factRow('Source', item.source || 'RoachNet mirror')}
          ${factRow('Artifact lane', item.artifactLabel)}
          ${factRow('Provider', artifact.provider || item.installIntent?.artifactProvider || 'RoachNet catalog')}
          ${factRow('Object key', artifact.key || item.installIntent?.artifactKey, { mono: true })}
          ${factRow('Download URL', artifactUrl, { href: artifactUrl, mono: true })}
          ${factRow('Source fallback', artifact.sourceUrl, { href: artifact.sourceUrl, mono: true })}
          ${factRow('SHA-256', artifact.sha256, { mono: true })}
          ${factRow('Checksum file', artifact.checksumUrl, { href: artifact.checksumUrl, mono: true })}
        </dl>
      </section>
    </article>
  `
}

function openDetail(id, trigger) {
  const item = findItemById(id)
  if (!item || !detailOverlay || !detailContent) return

  window.clearTimeout(detailCloseTimer)
  detailClosing = false
  detailTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement instanceof HTMLElement ? document.activeElement : null
  detailContent.innerHTML = renderDetail(item)
  detailContent.scrollTop = 0
  detailOverlay.hidden = false
  document.body.classList.add('app-detail-open')
  void detailOverlay.offsetWidth
  detailOverlay.classList.add('is-open')
  requestAnimationFrame(() => {
    if (!detailOverlay.hidden) detailClose?.focus()
  })
}

function closeDetail() {
  if (!detailOverlay || !detailContent || detailOverlay.hidden || detailClosing) return

  detailClosing = true
  detailOverlay.classList.remove('is-open')
  document.body.classList.remove('app-detail-open')
  const trigger = detailTrigger
  detailTrigger = null
  if (trigger?.isConnected) {
    trigger.focus({ preventScroll: true })
  } else {
    document.querySelector('#apps-main')?.focus({ preventScroll: true })
  }
  if (/^#app-/.test(window.location.hash)) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  const finish = () => {
    detailClosing = false
    detailOverlay.hidden = true
    detailContent.innerHTML = ''
  }
  if (motionOK()) {
    detailCloseTimer = window.setTimeout(finish, 260)
  } else {
    finish()
  }
}

async function copyItemLink(button) {
  const id = button.dataset.copyLink
  const url = `${window.location.origin}${window.location.pathname}#app-${encodeURIComponent(id)}`
  const label = button.querySelector('.st-copy__label')
  try {
    await navigator.clipboard.writeText(url)
    button.classList.add('is-done')
    if (label) label.textContent = 'Link copied'
    showToast('Link copied to your clipboard')
    window.setTimeout(() => {
      button.classList.remove('is-done')
      if (label) label.textContent = 'Copy link'
    }, 1800)
  } catch {
    showToast(`Copy this by hand: ${url}`)
  }
}

function openFromHash() {
  const match = /^#app-(.+)$/.exec(window.location.hash)
  if (!match) return false
  const id = decodeURIComponent(match[1])
  if (!findItemById(id)) return false
  openDetail(id, null)
  return true
}

/* ---------------------------------------------------------------------------
   Loading
   ------------------------------------------------------------------------ */

async function loadCatalog() {
  storeStage?.setAttribute('aria-busy', 'true')
  const slowTimer = window.setTimeout(() => {
    if (state.catalog || !storeStage || storeStage.querySelector('.st-slow')) return
    storeStage.insertAdjacentHTML(
      'beforeend',
      '<p class="st-slow">Still fetching the catalog. It is one file, so a slow connection is the usual suspect.</p>'
    )
  }, 4000)

  try {
    const response = await fetch('./app-store-catalog.json', {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    state.catalog = await response.json()
    state.items = (Array.isArray(state.catalog?.items) ? state.catalog.items : []).map(enrichItem)
    window.clearTimeout(slowTimer)
    totalNodes.forEach((node) => {
      node.textContent = plural(state.items.length, 'install')
    })
    if (searchInput) searchInput.placeholder = `Search ${state.items.length} installs`
    buildRail()
    animateNextRender = true
    renderStore()
    // A deep link to a section (#models, #voice…) lands on that section.
    if (state.activeSection !== 'Today') requestAnimationFrame(() => scrollToContent({ force: true }))
    openFromHash()
  } catch (error) {
    window.clearTimeout(slowTimer)
    console.error(error)
    if (!storeStage) return
    storeStage.setAttribute('aria-busy', 'false')
    storeStage.innerHTML = `
      <section class="st-empty" aria-labelledby="apps-error-title">
        <span class="st-empty__art" aria-hidden="true"><span>?</span></span>
        <h2 class="st-empty__title" id="apps-error-title">The catalog did not load.</h2>
        <p class="st-empty__body">Your connection or ours. RoachNet itself is fine, and anything already installed still works.</p>
        <div class="st-empty__actions">
          <button class="nx-btn nx-btn--primary nx-btn--sm" type="button" data-retry>Try again</button>
        </div>
      </section>
    `
  }
}

/* ---------------------------------------------------------------------------
   Events
   ------------------------------------------------------------------------ */

sidebarNav?.addEventListener('click', (event) => {
  const link = event.target.closest('[data-section]')
  if (!link) return
  event.preventDefault()
  setActiveSection(link.dataset.section || 'Today')
})

sidebarNav?.addEventListener('keydown', (event) => {
  const current = event.target.closest('[data-section]')
  if (!current) return
  const items = [...sidebarNav.querySelectorAll('[data-section]')]
  const index = items.indexOf(current)
  if (index === -1) return

  let nextIndex = null
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = Math.min(items.length - 1, index + 1)
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1)
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = items.length - 1
  if (nextIndex === null || nextIndex === index) return

  event.preventDefault()
  items[nextIndex].focus()
  setActiveSection(items[nextIndex].dataset.section || 'Today')
})

document.querySelectorAll('[data-apps-section-jump]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const section = link.getAttribute('data-apps-section-jump') || 'Today'
    if (!sectionLookup.has(section)) return
    event.preventDefault()
    setActiveSection(section)
  })
})

searchInput?.addEventListener('input', (event) => {
  const wasEmpty = !state.query.trim()
  state.query = event.currentTarget.value || ''
  queueRender()
  announceResults()
  // On phones the results start below the fold; bring them up once, on the
  // first character, and leave the page alone after that.
  if (wasEmpty && state.query.trim() && compactLayout.matches) {
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToContent({ force: true })))
  }
})

searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchInput.value) {
    event.preventDefault()
    event.stopPropagation()
    setQuery('')
  } else if (event.key === 'Enter') {
    event.preventDefault()
    storeStage?.querySelector('[data-preview-id]')?.focus()
  }
})

storeContent?.addEventListener('click', (event) => {
  const sectionLink = event.target.closest('[data-section]')
  if (sectionLink) {
    event.preventDefault()
    setActiveSection(sectionLink.dataset.section || 'Today')
    return
  }

  const arrow = event.target.closest('[data-row-scroll]')
  if (arrow) {
    const scroller = document.getElementById(arrow.getAttribute('aria-controls') || '')
    if (scroller) scrollRow(scroller, Number(arrow.dataset.rowScroll) || 1)
    return
  }

  const suggestion = event.target.closest('[data-search-suggest]')
  if (suggestion) {
    setQuery(suggestion.dataset.searchSuggest || '', { focus: true })
    return
  }

  if (event.target.closest('[data-clear-search]')) {
    setQuery('', { focus: true })
    return
  }

  if (event.target.closest('[data-retry]')) {
    loadCatalog()
    return
  }

  const previewButton = event.target.closest('[data-preview-id]')
  if (previewButton) {
    event.preventDefault()
    openDetail(previewButton.dataset.previewId, previewButton)
  }
})

// Pointer light on cards and the hero (fine pointers, motion allowed).
let lightFrame = null
storeContent?.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || !motionOK() || event.pointerType !== 'mouse') return
  const surface = event.target.closest('.st-card, .st-hero')
  if (!surface || lightFrame) return
  lightFrame = requestAnimationFrame(() => {
    lightFrame = null
    const box = surface.getBoundingClientRect()
    surface.style.setProperty('--nx-mx', `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`)
    surface.style.setProperty('--nx-my', `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`)
  })
}, { passive: true })

detailClose?.addEventListener('click', closeDetail)

detailOverlay?.addEventListener('click', (event) => {
  if (event.target === detailOverlay) {
    closeDetail()
    return
  }
  const copyButton = event.target.closest('[data-copy-link]')
  if (copyButton) copyItemLink(copyButton)
})

document.addEventListener('keydown', (event) => {
  const detailOpen = detailOverlay && !detailOverlay.hidden && !detailClosing

  if (event.key === 'Tab' && detailOpen) {
    const focusable = [...detailOverlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement && element.getClientRects().length > 0)
    if (!focusable.length) return
    const activeIndex = focusable.indexOf(document.activeElement)
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
      : (activeIndex < 0 || activeIndex >= focusable.length - 1 ? 0 : activeIndex + 1)
    event.preventDefault()
    focusable[nextIndex].focus()
    return
  }

  if (event.key === 'Escape' && detailOpen) {
    event.preventDefault()
    closeDetail()
    return
  }

  // "/" jumps to search from anywhere that is not already a text field.
  if (event.key === '/' && !detailOpen && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const target = event.target
    const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    if (typing || !searchInput) return
    event.preventDefault()
    searchInput.focus()
    searchInput.select()
  }
})

document.addEventListener('click', (event) => {
  const installLink = event.target.closest('a[href^="roachnet://install-content"]')
  if (!installLink) return

  event.preventDefault()
  installLink.classList.add('is-launching')
  announce(`Opening RoachNet to install ${installLink.dataset.installTitle || 'this pack'}.`)
  window.setTimeout(() => installLink.classList.remove('is-launching'), 1600)
  attemptNativeInstall(installLink.getAttribute('href') || '')
})

window.addEventListener('hashchange', () => {
  if (/^#app-/.test(window.location.hash)) {
    openFromHash()
    return
  }
  const hash = window.location.hash.replace(/^#/, '')
  if (hash && !sectionSlugLookup.has(hash)) return
  const key = sectionSlugLookup.get(hash) || 'Today'
  if (key !== state.activeSection && state.catalog) {
    state.activeSection = key
    animateNextRender = true
    renderStore()
  }
})

window.addEventListener('popstate', () => {
  if (!window.location.hash && state.activeSection !== 'Today' && state.catalog) {
    state.activeSection = 'Today'
    animateNextRender = true
    renderStore()
  }
})

compactLayout.addEventListener?.('change', () => {
  keepRailItemInView(sidebarNav?.querySelector('.is-active'))
  storeStage?.querySelectorAll('.st-row__scroller').forEach(syncArrows)
})

window.addEventListener('resize', () => {
  storeStage?.querySelectorAll('.st-row__scroller').forEach(syncArrows)
}, { passive: true })

// Decorative loops (floating hero icon, skeleton shimmer) pause in a hidden tab.
document.addEventListener('visibilitychange', () => {
  root.classList.toggle('st-tab-hidden', document.visibilityState === 'hidden')
})

setDownloadButton()
startTelemetry()
loadCatalog()
