import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../collections/kiwix-categories.json', import.meta.url)
const data = JSON.parse(await readFile(file, 'utf8'))

function upsertCategory(spec, category) {
  let existing = spec.categories.find((entry) => entry.slug === category.slug)

  if (!existing) {
    existing = { ...category, tiers: [] }
    spec.categories.push(existing)
  } else {
    Object.assign(existing, { ...category, tiers: existing.tiers || [] })
  }

  return existing
}

function upsertTier(category, tier) {
  let existing = category.tiers.find((entry) => entry.slug === tier.slug)

  if (!existing) {
    existing = { ...tier, resources: [] }
    category.tiers.push(existing)
  } else {
    Object.assign(existing, { ...tier, resources: existing.resources || [] })
  }

  return existing
}

function parseSizeToMB(value) {
  if (typeof value === 'number') return value

  const match = String(value || '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)([KMG])$/i)

  if (!match) return undefined

  const amount = Number(match[1])
  const unit = match[2].toUpperCase()

  if (unit === 'K') return Math.max(1, Math.round(amount / 1024))
  if (unit === 'M') return Math.round(amount)
  if (unit === 'G') return Math.round(amount * 1024)
  return undefined
}

function upsertResource(tier, resource) {
  const normalized = {
    ...resource,
    size_mb: resource.size_mb ?? parseSizeToMB(resource.size),
  }

  delete normalized.size

  const index = tier.resources.findIndex((entry) => entry.id === normalized.id)

  if (index >= 0) {
    tier.resources[index] = normalized
    return
  }

  tier.resources.push(normalized)
}

const categoryDefinitions = {
  'science-simulations': {
    name: 'Science & Simulations',
    slug: 'science-simulations',
    icon: 'IconFlask',
    description:
      'Interactive simulations and science-heavy reference shelves for astronomy, physics, chemistry, biology, and lab-minded study.',
    language: 'en',
  },
  'maker-electronics': {
    name: 'Maker & Electronics',
    slug: 'maker-electronics',
    icon: 'IconCpu',
    description:
      'Boards, components, fabrication, and electronics learning packs for bench work, repairs, and hardware curiosity.',
    language: 'en',
  },
  'design-visual-media': {
    name: 'Design & Visual Media',
    slug: 'design-visual-media',
    icon: 'IconBrush',
    description:
      '3D, graphics, photography, and visual-production references that install as named RoachNet shelves.',
    language: 'en',
  },
  'travel-field-guides': {
    name: 'Travel & Field Guides',
    slug: 'travel-field-guides',
    icon: 'IconRouteSquare',
    description:
      'Offline travel guides and route-oriented reference shelves for planning on bad networks or no network at all.',
    language: 'en',
  },
  'dictionaries-primary-sources': {
    name: 'Dictionaries & Primary Sources',
    slug: 'dictionaries-primary-sources',
    icon: 'IconBooks',
    description:
      'Dictionaries, source texts, and deep public-domain shelves for machines that keep a real library close.',
    language: 'en',
  },
  'kids-family': {
    name: 'Kids & Family',
    slug: 'kids-family',
    icon: 'IconSparkles',
    description:
      'Youth-friendly encyclopedias, story collections, and learning shelves sized like RoachNet apps.',
    language: 'en',
  },
  'open-courses': {
    name: 'Open Courses & Lectures',
    slug: 'open-courses',
    icon: 'IconSchool',
    description:
      'Large open-course shelves, lecture archives, and study-heavy installs for serious offline learning.',
    language: 'en',
  },
  'law-history-society': {
    name: 'Law, History & Society',
    slug: 'law-history-society',
    icon: 'IconScale',
    description:
      'Law, politics, history, philosophy, and civic-reference shelves for people who like context with their work.',
    language: 'en',
  },
  'language-writing': {
    name: 'Language & Writing',
    slug: 'language-writing',
    icon: 'IconMessages',
    description:
      'English, linguistics, writing craft, and quote-heavy shelves for language work, reading, and editing.',
    language: 'en',
  },
  'finance-crypto': {
    name: 'Finance & Crypto',
    slug: 'finance-crypto',
    icon: 'IconCoins',
    description:
      'Investing, money, and crypto reference shelves that install like any other RoachNet app.',
    language: 'en',
  },
  'travel-mobility-outdoors': {
    name: 'Travel, Mobility & Outdoors',
    slug: 'travel-mobility-outdoors',
    icon: 'IconPlaneTilt',
    description:
      'Travel problem-solving, moving-around shelves, and route-minded practical reference for life away from home.',
    language: 'en',
  },
  'games-pop-culture': {
    name: 'Games, Film & Pop Culture',
    slug: 'games-pop-culture',
    icon: 'IconDeviceGamepad2',
    description:
      'Movies, anime, games, worldbuilding, and other culture-heavy shelves for when the machine is also your media brain.',
    language: 'en',
  },
  'homestead-sustainability': {
    name: 'Homestead & Sustainability',
    slug: 'homestead-sustainability',
    icon: 'IconLeaf2',
    description:
      'Practical self-reliance, energy, gardening, and build-it-yourself reference for longer-lived offline setups.',
    language: 'en',
  },
  'math-logic': {
    name: 'Math & Problem Solving',
    slug: 'math-logic',
    icon: 'IconSigma',
    description:
      'Problem-solving, proof-heavy reference, and math course shelves that feel at home beside the Dev lane.',
    language: 'en',
  },
  'platforms-systems': {
    name: 'Platforms & Systems',
    slug: 'platforms-systems',
    icon: 'IconDeviceLaptop',
    description:
      'OS-specific docs, package-manager know-how, and platform shelves for long-lived machine setups.',
    language: 'en',
  },
  'security-privacy': {
    name: 'Security & Privacy',
    slug: 'security-privacy',
    icon: 'IconShieldLock',
    description:
      'Security, privacy, reverse-engineering, and defense-minded shelves for people who want the machine to stay theirs.',
    language: 'en',
  },
}

const tierAdds = [
  {
    category: 'education',
    tier: {
      name: 'Standard',
      slug: 'education-standard',
      description: 'Adds educational videos, university-level tutorials, and STEM textbooks. Includes Essential.',
      includesTier: 'education-essential',
    },
    resources: [
      {
        id: 'libretexts.org_en_k12',
        version: '2026-01',
        title: 'LibreTexts K-12',
        description: 'School-age math, science, and general study textbooks',
        url: 'https://download.kiwix.org/zim/libretexts/libretexts.org_en_k12_2026-01.zim',
        size_mb: 353,
      },
    ],
  },
  {
    category: 'education',
    tier: {
      name: 'Comprehensive',
      slug: 'education-comprehensive',
      description: 'Complete educational library with enhanced textbooks and TED talks. Includes Standard.',
      includesTier: 'education-standard',
    },
    resources: [
      {
        id: 'academia.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Academia Q&A',
        description: 'Research, publishing, grad-school, and academic-workflow discussions',
        url: 'https://download.kiwix.org/zim/stack_exchange/academia.stackexchange.com_en_all_2026-02.zim',
        size_mb: 279,
      },
      {
        id: 'cseducators.stackexchange.com_en_all',
        version: '2026-02',
        title: 'CS Educators Q&A',
        description: 'Teaching computer science, curriculum design, and classroom practice',
        url: 'https://download.kiwix.org/zim/stack_exchange/cseducators.stackexchange.com_en_all_2026-02.zim',
        size_mb: 16,
      },
      {
        id: 'libretexts.org_en_socialsci',
        version: '2025-01',
        title: 'LibreTexts Social Sciences',
        description: 'Politics, sociology, psychology, and society-focused textbooks',
        url: 'https://download.kiwix.org/zim/libretexts/libretexts.org_en_socialsci_2025-01.zim',
        size_mb: 1946,
      },
      {
        id: 'libretexts.org_en_workforce',
        version: '2026-01',
        title: 'LibreTexts Workforce',
        description: 'Career, technical, and workforce-development course texts',
        url: 'https://download.kiwix.org/zim/libretexts/libretexts.org_en_workforce_2026-01.zim',
        size_mb: 490,
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Standard',
      slug: 'computing-standard',
      description: 'Add the web stack, version-control training, and container fundamentals. Includes Essential.',
      includesTier: 'computing-essential',
    },
    resources: [
      {
        id: 'freecodecamp_en_coding-interview-prep',
        version: '2026-02',
        title: 'freeCodeCamp: Coding Interview Prep',
        description: 'Challenge-driven prep for whiteboard-style coding and algorithm questions',
        url: 'https://download.kiwix.org/zim/freecodecamp/freecodecamp_en_coding-interview-prep_2026-02.zim',
        size_mb: 6,
      },
      {
        id: 'freecodecamp_en_project-euler',
        version: '2026-02',
        title: 'freeCodeCamp: Project Euler',
        description: 'Math-heavy programming problems for sharpening problem-solving under constraints',
        url: 'https://download.kiwix.org/zim/freecodecamp/freecodecamp_en_project-euler_2026-02.zim',
        size_mb: 7,
      },
      {
        id: 'freecodecamp_en_rosetta-code',
        version: '2026-02',
        title: 'freeCodeCamp: Rosetta Code',
        description: 'Cross-language programming tasks and pattern comparisons in one compact archive',
        url: 'https://download.kiwix.org/zim/freecodecamp/freecodecamp_en_rosetta-code_2026-02.zim',
        size_mb: 7,
      },
      {
        id: 'devdocs_en_typescript',
        version: '2026-04',
        title: 'TypeScript Docs',
        description: 'Types, tooling, and API reference for modern JavaScript work',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_typescript_2026-04.zim',
        size_mb: 1,
      },
      {
        id: 'coreyms_en_javascript-tutorials',
        version: '2025-10',
        title: 'Corey Schafer: JavaScript Tutorials',
        description: 'Practical JavaScript videos for fundamentals and browser-side work',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_javascript-tutorials_2025-10.zim',
        size_mb: 42,
      },
      {
        id: 'coreyms_en_sql-tutorials',
        version: '2026-04',
        title: 'Corey Schafer: SQL Tutorials',
        description: 'Querying, joins, schema basics, and everyday database work in video form',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_sql-tutorials_2026-04.zim',
        size_mb: 22,
      },
      {
        id: 'coreyms_en_git-tutorials',
        version: '2026-04',
        title: 'Corey Schafer: Git Tutorials',
        description: 'Version control fundamentals, branching, remotes, and practical Git workflow',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_git-tutorials_2026-04.zim',
        size: '57M',
      },
      {
        id: 'gobyexample.com_en_all',
        version: '2026-02',
        title: 'Go by Example',
        description: 'A compact hands-on Go shelf with runnable examples and short explanations',
        url: 'https://download.kiwix.org/zim/zimit/gobyexample.com_en_all_2026-02.zim',
        size: '322K',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Comprehensive',
      slug: 'computing-comprehensive',
      description: 'Fill out the language shelf with systems-level references and cloud-native runtime docs. Includes Standard.',
      includesTier: 'computing-standard',
    },
    resources: [
      {
        id: 'coreyms_en_django-tutorials',
        version: '2025-10',
        title: 'Corey Schafer: Django Tutorials',
        description: 'Django apps, models, auth, and practical Python web workflows',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_django-tutorials_2025-10.zim',
        size_mb: 271,
      },
      {
        id: 'coreyms_en_flask-tutorials',
        version: '2026-04',
        title: 'Corey Schafer: Flask Tutorials',
        description: 'Flask routes, APIs, templating, and small-service patterns',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_flask-tutorials_2026-04.zim',
        size_mb: 257,
      },
      {
        id: 'devdocs_en_nextjs',
        version: '2026-04',
        title: 'Next.js Docs',
        description: 'App Router patterns, routing, rendering, and deployment reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_nextjs_2026-04.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_vite',
        version: '2026-04',
        title: 'Vite Docs',
        description: 'Build tooling and dev-server reference for fast modern frontends',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_vite_2026-04.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_tailwindcss',
        version: '2026-02',
        title: 'Tailwind CSS Docs',
        description: 'Utility-first styling reference for fast UI work inside the vault',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_tailwindcss_2026-02.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_playwright',
        version: '2026-04',
        title: 'Playwright Docs',
        description: 'Browser automation and end-to-end testing reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_playwright_2026-04.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_electron',
        version: '2026-04',
        title: 'Electron Docs',
        description: 'Desktop app patterns for Chromium and Node-powered builds',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_electron_2026-04.zim',
        size_mb: 2,
      },
      {
        id: 'devdocs_en_vue',
        version: '2026-02',
        title: 'Vue Docs',
        description: 'Reactive UI reference for Vue components, routing, and state work',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_vue_2026-02.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_svelte',
        version: '2026-01',
        title: 'Svelte Docs',
        description: 'Reactive component patterns and compiler-powered frontend reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_svelte_2026-01.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_astro',
        version: '2026-04',
        title: 'Astro Docs',
        description: 'Content-site, islands, and hybrid rendering reference for modern web builds',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_astro_2026-04.zim',
        size_mb: 2,
      },
    ],
  },
  {
    category: 'machine-learning',
    tier: {
      name: 'Comprehensive',
      slug: 'machine-learning-comprehensive',
      description: 'Pull the heavier video shelf once you want a deeper offline ML course library. Includes Standard.',
      includesTier: 'machine-learning-standard',
    },
    resources: [
      {
        id: 'devdocs_en_numpy',
        version: '2026-04',
        title: 'NumPy Docs',
        description: 'Array computing and scientific Python reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_numpy_2026-04.zim',
        size: '5.0M',
      },
      {
        id: 'devdocs_en_pandas',
        version: '2026-04',
        title: 'Pandas Docs',
        description: 'Dataframe-heavy data wrangling and analysis reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_pandas_2026-04.zim',
        size: '4.7M',
      },
      {
        id: 'devdocs_en_pytorch',
        version: '2026-04',
        title: 'PyTorch Docs',
        description: 'Deep learning, tensor ops, and model-building reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_pytorch_2026-04.zim',
        size: '6.1M',
      },
      {
        id: 'devdocs_en_scikit-learn',
        version: '2026-04',
        title: 'scikit-learn Docs',
        description: 'Classical machine-learning algorithms, preprocessing, and evaluation reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_scikit-learn_2026-04.zim',
        size: '54M',
      },
      {
        id: 'lost-stats.github.io_en_all',
        version: '2026-03',
        title: 'Lost Stats',
        description: 'Applied statistics, causal-inference, and data-work notes that bridge theory and practice',
        url: 'https://download.kiwix.org/zim/zimit/lost-stats.github.io_en_all_2026-03.zim',
        size: '14M',
      },
    ],
  },
  {
    category: 'music-audio',
    tier: {
      name: 'Comprehensive',
      slug: 'music-audio-comprehensive',
      description: 'The large music shelf for deeper study, inspiration, and long-lived offline reference. Includes Standard.',
      includesTier: 'music-audio-standard',
    },
    resources: [
      {
        id: 'fretmap.app_en_all',
        version: '2024-10',
        title: 'FretMap',
        description: 'Chord and fretboard reference for guitar-minded writing, arranging, and study',
        url: 'https://download.kiwix.org/zim/zimit/fretmap.app_en_all_2024-10.zim',
        size: '50M',
      },
      {
        id: 'celticscores.com_en_all',
        version: '2026-02',
        title: 'Celtic Scores',
        description: 'A deep notation shelf full of tune transcriptions and score reference',
        url: 'https://download.kiwix.org/zim/zimit/celticscores.com_en_all_2026-02.zim',
        size: '5.3G',
      },
    ],
  },
  {
    category: 'travel-mobility-outdoors',
    tier: {
      name: 'Comprehensive',
      slug: 'travel-mobility-outdoors-comprehensive',
      description: 'The broader mobility shelf for more specialized movement and navigation contexts. Includes Standard.',
      includesTier: 'travel-mobility-outdoors-standard',
    },
    resources: [
      {
        id: 'anonymousplanet.org_en_all',
        version: '2026-02',
        title: 'Anonymous Planet',
        description: 'Travel and operational-security guidance for moving carefully through the world',
        url: 'https://download.kiwix.org/zim/zimit/anonymousplanet.org_en_all_2026-02.zim',
        size: '27M',
      },
    ],
  },
  {
    category: 'games-pop-culture',
    tier: {
      name: 'Comprehensive',
      slug: 'games-pop-culture-comprehensive',
      description: 'The deeper genre and worldbuilding shelf for machines that keep culture close. Includes Standard.',
      includesTier: 'games-pop-culture-standard',
    },
    resources: [
      {
        id: 'allthetropes_en_all_maxi',
        version: '2025-07',
        title: 'All The Tropes',
        description: 'Story devices, genre vocabulary, and media-pattern reference for writing and culture-brain tangents',
        url: 'https://download.kiwix.org/zim/other/allthetropes_en_all_maxi_2025-07.zim',
        size: '1.4G',
      },
      {
        id: 'bulbagarden_en_all_maxi',
        version: '2026-02',
        title: 'Bulbagarden',
        description: 'A big fandom/wiki shelf for Pokemon lore, mechanics, and franchise reference',
        url: 'https://download.kiwix.org/zim/other/bulbagarden_en_all_maxi_2026-02.zim',
        size: '2.8G',
      },
    ],
  },
  {
    category: 'homestead-sustainability',
    tier: {
      name: 'Comprehensive',
      slug: 'homestead-sustainability-comprehensive',
      description: 'The broader hand-built shelf once the basics are already sitting in the vault. Includes Standard.',
      includesTier: 'homestead-sustainability-standard',
    },
    resources: [
      {
        id: 'cd3wdproject.org_en_all',
        version: '2025-11',
        title: 'CD3WD Project',
        description: 'Appropriate-technology, farming, engineering, and field-manual reference for build-it-yourself setups',
        url: 'https://download.kiwix.org/zim/zimit/cd3wdproject.org_en_all_2025-11.zim',
        size: '554M',
      },
    ],
  },
  {
    category: 'math-logic',
    tier: {
      name: 'Essential',
      slug: 'math-logic-essential',
      description: 'Start with compact problem-solving shelves and practical math reference.',
      recommended: true,
    },
    resources: [
      // In Essential so the recommended tier always has a book Kiwix still
      // serves (the Avanti courses below have dropped out of the library).
      {
        id: 'matheducators.stackexchange.com_en_all',
        version: '2026-08',
        title: 'Math Educators Q&A',
        description: 'Teaching math, curriculum structure, and explaining hard concepts clearly',
        url: 'https://download.kiwix.org/zim/stack_exchange/matheducators.stackexchange.com_en_all_2026-08.zim',
        size: '58M',
      },
      {
        id: 'avanti-fundamentals-of-mathematics',
        version: '2025-09',
        title: 'Avanti: Fundamentals of Mathematics',
        description: 'Video lessons covering core math concepts in a classroom-style format',
        url: 'https://download.kiwix.org/zim/videos/avanti-fundamentals-of-mathematics_2025-09.zim',
        size: '176M',
      },
      {
        id: 'avanti-3dimensional-geometry',
        version: '2025-05',
        title: 'Avanti: 3D Geometry',
        description: 'A compact geometry course app for spatial intuition, diagrams, and shape-heavy reasoning',
        url: 'https://download.kiwix.org/zim/videos/avanti-3dimensional-geometry_2025-05.zim',
        size: '75M',
      },
    ],
  },
  {
    category: 'math-logic',
    tier: {
      name: 'Standard',
      slug: 'math-logic-standard',
      description: 'Bring in the broader problem-solving and course lane once the compact shelf is in place. Includes Essential.',
      includesTier: 'math-logic-essential',
    },
    resources: [
      {
        id: 'math.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Mathematics Q&A',
        description: 'A huge applied-and-pure math shelf for proofs, examples, edge cases, and worked intuition',
        url: 'https://download.kiwix.org/zim/stack_exchange/math.stackexchange.com_en_all_2026-02.zim',
        size: '6.9G',
      },
      {
        id: 'avanti-binomial-theorem',
        version: '2025-09',
        title: 'Avanti: Binomial Theorem',
        description: 'A focused video course app for combinatorics and expansion patterns',
        url: 'https://download.kiwix.org/zim/videos/avanti-binomial-theorem_2025-09.zim',
        size: '162M',
      },
      {
        id: 'avanti-complex-numbers',
        version: '2025-09',
        title: 'Avanti: Complex Numbers',
        description: 'A tighter course lane on imaginary numbers, forms, and operations',
        url: 'https://download.kiwix.org/zim/videos/avanti-complex-numbers_2025-09.zim',
        size: '232M',
      },
    ],
  },
  {
    category: 'math-logic',
    tier: {
      name: 'Comprehensive',
      slug: 'math-logic-comprehensive',
      description: 'The big proof-and-reference shelf for machines that keep serious math close. Includes Standard.',
      includesTier: 'math-logic-standard',
    },
    resources: [
      {
        id: 'mathoverflow.net_en_all',
        version: '2026-02',
        title: 'MathOverflow',
        description: 'Research-level math discussion, deeper proofs, and specialist reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/mathoverflow.net_en_all_2026-02.zim',
        size: '808M',
      },
      {
        id: 'avanti-differential-equations',
        version: '2025-09',
        title: 'Avanti: Differential Equations',
        description: 'A focused video lane for differential equations and worked solution patterns',
        url: 'https://download.kiwix.org/zim/videos/avanti-differential-equations_2025-09.zim',
        size: '100M',
      },
      {
        id: 'avanti-statistics',
        version: '2025-09',
        title: 'Avanti: Statistics',
        description: 'A concise statistics course app for probability, distributions, and reasoning',
        url: 'https://download.kiwix.org/zim/videos/avanti-statistics_2025-09.zim',
        size: '64M',
      },
      {
        id: 'jeffe.cs.illinois.edu_en_all',
        version: '2026-03',
        title: 'Algorithms by Jeff Erickson',
        description: 'A rigorous algorithms textbook to read beside the deeper math',
        url: 'https://download.kiwix.org/zim/zimit/jeffe.cs.illinois.edu_en_all_2026-03.zim',
        size: '493M',
      },
    ],
  },
  {
    category: 'platforms-systems',
    tier: {
      name: 'Essential',
      slug: 'platforms-systems-essential',
      description: 'Start with lightweight OS and package-manager guidance for the machines you actually live on.',
      recommended: true,
    },
    resources: [
      {
        id: 'homebrew.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Homebrew Q&A',
        description: 'Package-manager troubleshooting, formulas, casks, and macOS setup discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/homebrew.stackexchange.com_en_all_2026-02.zim',
        size: '36M',
      },
      {
        id: 'archlinux_en_all_maxi',
        version: '2025-09',
        title: 'Arch Linux Docs',
        description: 'The Arch wiki as a compact systems shelf for Linux setup, recovery, and long-tail fixes',
        url: 'https://download.kiwix.org/zim/other/archlinux_en_all_maxi_2025-09.zim',
        size: '30M',
      },
      {
        id: 'alpinelinux_en_all_maxi',
        version: '2026-01',
        title: 'Alpine Linux Docs',
        description: 'Small-footprint Linux docs for containers, tiny systems, and package work',
        url: 'https://download.kiwix.org/zim/other/alpinelinux_en_all_maxi_2026-01.zim',
        size: '2.9M',
      },
    ],
  },
  {
    category: 'platforms-systems',
    tier: {
      name: 'Standard',
      slug: 'platforms-systems-standard',
      description: 'Add SBC and desktop-platform context once the light systems shelf is in place. Includes Essential.',
      includesTier: 'platforms-systems-essential',
    },
    resources: [
      {
        id: 'raspberrypi.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Raspberry Pi Q&A',
        description: 'Pi setup, GPIO, Linux-on-small-hardware, and field troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/raspberrypi.stackexchange.com_en_all_2026-02.zim',
        size: '285M',
      },
      {
        id: 'elementaryos.stackexchange.com_en_all',
        version: '2026-02',
        title: 'elementary OS Q&A',
        description: 'Desktop Linux setup, app behavior, and OS-specific troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/elementaryos.stackexchange.com_en_all_2026-02.zim',
        size: '54M',
      },
    ],
  },
  {
    category: 'platforms-systems',
    tier: {
      name: 'Comprehensive',
      slug: 'platforms-systems-comprehensive',
      description: 'The broader platform shelf for older Linux lore and long-tail systems fixes. Includes Standard.',
      includesTier: 'platforms-systems-standard',
    },
    resources: [
      {
        id: 'gentoo_en_all_maxi',
        version: '2021-03',
        title: 'Gentoo Docs',
        description: 'Source-based Linux reference for systems tinkerers and people who like knowing every layer',
        url: 'https://download.kiwix.org/zim/other/gentoo_en_all_maxi_2021-03.zim',
        size: '69M',
      },
    ],
  },
  {
    category: 'machine-learning',
    tier: {
      name: 'Essential',
      slug: 'machine-learning-essential',
      description: 'Start with statistics and data-handling fundamentals before you pull the heavier model packs.',
    },
    resources: [
      {
        id: 'learningstatisticswithr.com_en_all',
        version: '2026-02',
        title: 'Learning Statistics with R',
        description: 'Statistics through the lens of R, inference, and practical quantitative thinking',
        url: 'https://download.kiwix.org/zim/zimit/learningstatisticswithr.com_en_all_2026-02.zim',
        size_mb: 15,
      },
    ],
  },
  {
    category: 'machine-learning',
    tier: {
      name: 'Standard',
      slug: 'machine-learning-standard',
      description: 'Layer in the practical model-tool docs most people actually use. Includes Essential.',
      includesTier: 'machine-learning-essential',
    },
    resources: [
      {
        id: 'libretexts.org_en_stats',
        version: '2026-01',
        title: 'LibreTexts Statistics',
        description: 'Probability, inference, regression, and statistical methods textbooks',
        url: 'https://download.kiwix.org/zim/libretexts/libretexts.org_en_stats_2026-01.zim',
        size_mb: 206,
      },
      {
        id: 'coreyms_en_pandas-tutorials',
        version: '2026-03',
        title: 'Corey Schafer: Pandas Tutorials',
        description: 'Dataframes, cleaning, reshaping, and analysis workflows in video form',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_pandas-tutorials_2026-03.zim',
        size_mb: 165,
      },
      {
        id: 'coreyms_en_matplotlib-tutorials',
        version: '2026-04',
        title: 'Corey Schafer: Matplotlib Tutorials',
        description: 'Plotting, chart composition, and data visualization in Python',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_matplotlib-tutorials_2026-04.zim',
        size_mb: 104,
      },
      {
        id: 'datascience.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Data Science Q&A',
        description: 'Applied data-science discussion on tooling, modeling, and analysis workflows',
        url: 'https://download.kiwix.org/zim/stack_exchange/datascience.stackexchange.com_en_all_2026-02.zim',
        size_mb: 261,
      },
    ],
  },
  {
    category: 'machine-learning',
    tier: {
      name: 'Comprehensive',
      slug: 'machine-learning-comprehensive',
      description: 'Pull the heavier video shelf once you want a deeper offline ML course library. Includes Standard.',
      includesTier: 'machine-learning-standard',
    },
    resources: [
      {
        id: 'ai.stackexchange.com_en_all',
        version: '2026-02',
        title: 'AI Q&A',
        description: 'General AI discussion, model workflows, and implementation questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/ai.stackexchange.com_en_all_2026-02.zim',
        size_mb: 100,
      },
      {
        id: 'genai.stackexchange.com_en_all',
        version: '2026-02',
        title: 'GenAI Q&A',
        description: 'Practical large-language-model and generative-AI troubleshooting and patterns',
        url: 'https://download.kiwix.org/zim/stack_exchange/genai.stackexchange.com_en_all_2026-02.zim',
        size_mb: 10,
      },
      {
        id: 'devdocs_en_scikit-image',
        version: '2026-04',
        title: 'scikit-image Docs',
        description: 'Image processing reference for computer vision and scientific imaging workflows',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_scikit-image_2026-04.zim',
        size_mb: 11,
      },
    ],
  },
  {
    category: 'music-audio',
    tier: {
      name: 'Standard',
      slug: 'music-audio-standard',
      description: 'Bring in sound-focused talks and listening material for production and audio-thinking. Includes Essential.',
      includesTier: 'music-audio-essential',
    },
    resources: [
      {
        id: 'sound.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Sound Q&A',
        description: 'Questions on acoustics, sound design, live audio, and playback systems',
        url: 'https://download.kiwix.org/zim/stack_exchange/sound.stackexchange.com_en_all_2026-02.zim',
        size_mb: 73,
      },
      {
        id: 'music.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Music Q&A',
        description: 'Harmony, arranging, notation, performance, and composition discussions',
        url: 'https://download.kiwix.org/zim/stack_exchange/music.stackexchange.com_en_all_2026-02.zim',
        size_mb: 323,
      },
    ],
  },
  {
    category: 'music-audio',
    tier: {
      name: 'Comprehensive',
      slug: 'music-audio-comprehensive',
      description: 'The large music shelf for deeper study, inspiration, and long-lived offline reference. Includes Standard.',
      includesTier: 'music-audio-standard',
    },
    resources: [
      {
        id: 'dsp.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Signal Processing Q&A',
        description: 'Filters, transforms, DSP workflows, and practical math for audio and signals',
        url: 'https://download.kiwix.org/zim/stack_exchange/dsp.stackexchange.com_en_all_2026-02.zim',
        size_mb: 360,
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Standard',
      slug: 'it-infrastructure-standard',
      description: 'Add web and edge-infrastructure learning once the Linux base shelf is in place. Includes Essential.',
      includesTier: 'it-infrastructure-essential',
    },
    resources: [
      {
        id: 'askubuntu.com_en_all',
        version: '2025-12',
        title: 'Ask Ubuntu',
        description: 'Ubuntu setup, troubleshooting, packaging, and admin reference from years of Q&A',
        url: 'https://download.kiwix.org/zim/stack_exchange/askubuntu.com_en_all_2025-12.zim',
        size_mb: 2662,
      },
      {
        id: 'devdocs_en_nginx',
        version: '2026-04',
        title: 'Nginx Docs',
        description: 'HTTP server, reverse proxy, and production web-serving reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_nginx_2026-04.zim',
        size_mb: 1,
      },
      {
        id: 'devdocs_en_postgresql',
        version: '2026-02',
        title: 'PostgreSQL Docs',
        description: 'Database administration and query reference for serious local services',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_postgresql_2026-02.zim',
        size_mb: 3,
      },
      {
        id: 'devdocs_en_redis',
        version: '2026-04',
        title: 'Redis Docs',
        description: 'Caching, data structures, and operational reference for fast local services',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_redis_2026-04.zim',
        size_mb: 1,
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Comprehensive',
      slug: 'it-infrastructure-comprehensive',
      description: 'Pull in the broader security shelf once you want more context around threat models and defensive ops. Includes Standard.',
      includesTier: 'it-infrastructure-standard',
    },
    resources: [
      {
        id: 'serverfault.com_en_all',
        version: '2026-02',
        title: 'Server Fault Q&A',
        description: 'Production server, hosting, and systems administration discussions',
        url: 'https://download.kiwix.org/zim/stack_exchange/serverfault.com_en_all_2026-02.zim',
        size_mb: 1536,
      },
      {
        id: 'superuser.com_en_all',
        version: '2026-02',
        title: 'Superuser Q&A',
        description: 'Desktop ops, utilities, and troubleshooting across long-lived machines',
        url: 'https://download.kiwix.org/zim/stack_exchange/superuser.com_en_all_2026-02.zim',
        size_mb: 3789,
      },
      {
        id: 'unix.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Unix & Linux Q&A',
        description: 'Shell, processes, filesystems, and day-to-day Unix operator knowledge',
        url: 'https://download.kiwix.org/zim/stack_exchange/unix.stackexchange.com_en_all_2026-02.zim',
        size_mb: 1229,
      },
      {
        id: 'security.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Security Q&A',
        description: 'Practical security, privacy, defense, and threat-model discussions',
        url: 'https://download.kiwix.org/zim/stack_exchange/security.stackexchange.com_en_all_2026-02.zim',
        size_mb: 420,
      },
      {
        id: 'networkengineering.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Network Engineering Q&A',
        description: 'Routing, switching, access design, and network troubleshooting reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/networkengineering.stackexchange.com_en_all_2026-02.zim',
        size_mb: 124,
      },
      {
        id: 'devdocs_en_ansible',
        version: '2026-04',
        title: 'Ansible Docs',
        description: 'Automation and configuration-management reference for repeatable machine setup',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_ansible_2026-04.zim',
        size_mb: 30,
      },
      {
        id: 'apple.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Apple Q&A',
        description: 'macOS, iOS, and Apple hardware troubleshooting from years of practical questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/apple.stackexchange.com_en_all_2026-02.zim',
        size_mb: 1126,
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Essential',
      slug: 'science-simulations-essential',
      description: 'Start with interactive lab basics and a compact astronomy reference.',
      recommended: true,
    },
    resources: [
      {
        id: 'phet_en_all',
        version: '2026-02',
        title: 'PhET Interactive Simulations',
        description: 'Physics, chemistry, math, and engineering simulations you can actually play with offline',
        url: 'https://download.kiwix.org/zim/phet/phet_en_all_2026-02.zim',
        size_mb: 102,
      },
      {
        id: 'astronomy.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Astronomy Q&A',
        description: 'Space, observation, orbital mechanics, and telescope questions from the field',
        url: 'https://download.kiwix.org/zim/stack_exchange/astronomy.stackexchange.com_en_all_2026-02.zim',
        size_mb: 187,
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Standard',
      slug: 'science-simulations-standard',
      description: 'Broaden the lab shelf with practical Q&A across the core sciences. Includes Essential.',
      includesTier: 'science-simulations-essential',
    },
    resources: [
      {
        id: 'physics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Physics Q&A',
        description: 'Mechanics, electromagnetism, thermodynamics, and theory-heavy troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/physics.stackexchange.com_en_all_2026-02.zim',
        size_mb: 1741,
      },
      {
        id: 'chemistry.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Chemistry Q&A',
        description: 'Reactions, lab practice, spectroscopy, and chemical reasoning discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/chemistry.stackexchange.com_en_all_2026-02.zim',
        size_mb: 397,
      },
      {
        id: 'biology.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Biology Q&A',
        description: 'Cell biology, genetics, ecology, and organism-level questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/biology.stackexchange.com_en_all_2026-02.zim',
        size_mb: 403,
      },
      {
        id: 'biologycourses_en_all',
        version: '2026-03',
        title: 'Biology Courses',
        description: 'A video-heavy biology shelf covering core concepts and classroom-style explanations',
        url: 'https://download.kiwix.org/zim/videos/biologycourses_en_all_2026-03.zim',
        size: '190M',
      },
      {
        id: 'avanti-modern-physics',
        version: '2025-09',
        title: 'Avanti: Modern Physics',
        description: 'Video lessons on modern physics topics, concepts, and worked explanations',
        url: 'https://download.kiwix.org/zim/videos/avanti-modern-physics_2025-09.zim',
        size: '106M',
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Comprehensive',
      slug: 'science-simulations-comprehensive',
      description: 'Specialized scientific reference for longer study sessions. Includes Standard.',
      includesTier: 'science-simulations-standard',
    },
    resources: [
      {
        id: 'bioinformatics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Bioinformatics Q&A',
        description: 'Sequencing, pipelines, biological data analysis, and computational biology discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/bioinformatics.stackexchange.com_en_all_2026-02.zim',
        size_mb: 55,
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Essential',
      slug: 'maker-electronics-essential',
      description: 'Start with boards, components, and the electronics basics you actually reach for first.',
      recommended: true,
    },
    resources: [
      {
        id: 'arduino.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Arduino Q&A',
        description: 'Microcontroller questions, hobby hardware builds, and embedded troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/arduino.stackexchange.com_en_all_2026-02.zim',
        size_mb: 247,
      },
      {
        id: 'avanti-semiconductor-electronics',
        version: '2025-09',
        title: 'Semiconductor Electronics',
        description: 'A focused video shelf on semiconductor devices and electronics fundamentals',
        url: 'https://download.kiwix.org/zim/videos/avanti-semiconductor-electronics_2025-09.zim',
        size_mb: 136,
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Standard',
      slug: 'maker-electronics-standard',
      description: 'Add fabrication and object-making context once the bench basics are in place. Includes Essential.',
      includesTier: 'maker-electronics-essential',
    },
    resources: [
      {
        id: 'ted_mul_3d-printing',
        version: '2026-01',
        title: 'TED: 3D Printing',
        description: 'Talks and demos on rapid prototyping, fabrication, and printed-object workflows',
        url: 'https://download.kiwix.org/zim/ted/ted_mul_3d-printing_2026-01.zim',
        size_mb: 137,
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Comprehensive',
      slug: 'maker-electronics-comprehensive',
      description: 'The deeper hardware shelf with years of practical electronics problem-solving. Includes Standard.',
      includesTier: 'maker-electronics-standard',
    },
    resources: [
      {
        id: 'electronics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Electronics Q&A',
        description: 'Circuit analysis, components, embedded gear, and real-world electronics troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/electronics.stackexchange.com_en_all_2026-02.zim',
        size_mb: 3994,
      },
    ],
  },
  {
    category: 'design-visual-media',
    tier: {
      name: 'Essential',
      slug: 'design-visual-media-essential',
      description: 'Start with the visual craft shelves you are likely to open first on a real workstation.',
      recommended: true,
    },
    resources: [
      {
        id: 'graphicdesign.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Graphic Design Q&A',
        description: 'Typography, layout, branding, print prep, and design workflow discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/graphicdesign.stackexchange.com_en_all_2026-02.zim',
        size_mb: 884,
      },
      {
        id: 'photo.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Photography Q&A',
        description: 'Capture, lighting, lenses, editing, and practical camera problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/photo.stackexchange.com_en_all_2026-02.zim',
        size_mb: 431,
      },
    ],
  },
  {
    category: 'design-visual-media',
    tier: {
      name: 'Standard',
      slug: 'design-visual-media-standard',
      description: 'Bring in 3D production thinking and Blender-specific problem-solving. Includes Essential.',
      includesTier: 'design-visual-media-essential',
    },
    resources: [
      {
        id: 'blender.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Blender Q&A',
        description: 'Modeling, shading, animation, rendering, and Blender workflow fixes',
        url: 'https://download.kiwix.org/zim/stack_exchange/blender.stackexchange.com_en_all_2026-02.zim',
        size_mb: 2662,
      },
    ],
  },
  {
    category: 'design-visual-media',
    tier: {
      name: 'Comprehensive',
      slug: 'design-visual-media-comprehensive',
      description: 'The heavier visual shelf for long sessions in 3D, art direction, and media study. Includes Standard.',
      includesTier: 'design-visual-media-standard',
    },
    resources: [
      {
        id: 'studio.blender.org_en_open-movies',
        version: '2026-03',
        title: 'Blender Studio Open Movies',
        description: 'Open-production films and behind-the-scenes assets from Blender Studio',
        url: 'https://download.kiwix.org/zim/videos/studio.blender.org_en_open-movies_2026-03.zim',
        size_mb: 374,
      },
      {
        id: 'ted_mul_design',
        version: '2026-01',
        title: 'TED: Design',
        description: 'A broad visual-thinking talk archive on design, objects, and creative direction',
        url: 'https://download.kiwix.org/zim/ted/ted_mul_design_2026-01.zim',
        size_mb: 6042,
      },
    ],
  },
  {
    category: 'travel-field-guides',
    tier: {
      name: 'Essential',
      slug: 'travel-field-guides-essential',
      description: 'Start with the compact region-level travel shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'wikivoyage_en_europe_nopic',
        version: '2026-03',
        title: 'Wikivoyage: Europe',
        description: 'An offline Europe travel guide with city notes, transit guidance, and route context',
        url: 'https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_europe_nopic_2026-03.zim',
        size_mb: 67,
      },
    ],
  },
  {
    category: 'travel-field-guides',
    tier: {
      name: 'Standard',
      slug: 'travel-field-guides-standard',
      description: 'Move up to the broad world guide once the compact travel shelf is in place. Includes Essential.',
      includesTier: 'travel-field-guides-essential',
    },
    resources: [
      {
        id: 'wikivoyage_en_all_nopic',
        version: '2026-03',
        title: 'Wikivoyage: World Guide',
        description: 'Country, city, and route articles for a lightweight global travel reference',
        url: 'https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_2026-03.zim',
        size_mb: 221,
      },
    ],
  },
  {
    category: 'travel-field-guides',
    tier: {
      name: 'Comprehensive',
      slug: 'travel-field-guides-comprehensive',
      description: 'The image-rich travel archive for machines with more storage to burn. Includes Standard.',
      includesTier: 'travel-field-guides-standard',
    },
    resources: [
      {
        id: 'wikivoyage_en_all_maxi',
        version: '2026-03',
        title: 'Wikivoyage: World Guide (With Images)',
        description: 'The broader travel guide with photos and richer article context left intact',
        url: 'https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_maxi_2026-03.zim',
        size_mb: 1024,
      },
    ],
  },
  {
    category: 'dictionaries-primary-sources',
    tier: {
      name: 'Essential',
      slug: 'dictionaries-primary-sources-essential',
      description: 'Start with the compact wordbook before you pull the larger archives.',
      recommended: true,
    },
    resources: [
      {
        id: 'wiktionary_en_simple_all_nopic',
        version: '2026-01',
        title: 'Simple English Wiktionary',
        description: 'A lighter offline dictionary and word-reference shelf for fast lookup',
        url: 'https://download.kiwix.org/zim/wiktionary/wiktionary_en_simple_all_nopic_2026-01.zim',
        size_mb: 25,
      },
    ],
  },
  {
    category: 'dictionaries-primary-sources',
    tier: {
      name: 'Standard',
      slug: 'dictionaries-primary-sources-standard',
      description: 'Layer in the full dictionary and source-text shelf. Includes Essential.',
      includesTier: 'dictionaries-primary-sources-essential',
    },
    resources: [
      {
        id: 'wiktionary_en_all_nopic',
        version: '2026-02',
        title: 'English Wiktionary',
        description: 'A deep dictionary shelf with usage, etymology, and cross-language word notes',
        url: 'https://download.kiwix.org/zim/wiktionary/wiktionary_en_all_nopic_2026-02.zim',
        size_mb: 8397,
      },
      {
        id: 'wikisource_en_all_nopic',
        version: '2026-02',
        title: 'English Wikisource',
        description: 'Primary texts, public-domain books, speeches, and historical documents',
        url: 'https://download.kiwix.org/zim/wikisource/wikisource_en_all_nopic_2026-02.zim',
        size_mb: 11264,
      },
    ],
  },
  {
    category: 'dictionaries-primary-sources',
    tier: {
      name: 'Comprehensive',
      slug: 'dictionaries-primary-sources-comprehensive',
      description: 'Deep public-domain shelves for machines with serious storage headroom. Includes Standard.',
      includesTier: 'dictionaries-primary-sources-standard',
    },
    resources: [
      {
        id: 'gutenberg_en_lcc-q',
        version: '2026-03',
        title: 'Project Gutenberg: Science (LCC Q)',
        description: 'Public-domain science texts, manuals, and old technical writing grouped under LCC Q',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_lcc-q_2026-03.zim',
        size_mb: 17408,
      },
      {
        id: 'gutenberg_en_lcc-t',
        version: '2026-03',
        title: 'Project Gutenberg: Technology (LCC T)',
        description: 'Public-domain engineering and technology texts grouped under LCC T',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_lcc-t_2026-03.zim',
        size_mb: 12288,
      },
      {
        id: 'gutenberg_en_lcc-d',
        version: '2025-12',
        title: 'Project Gutenberg: History (LCC D)',
        description: 'Large historical archive of public-domain history material under LCC D',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_lcc-d_2025-12.zim',
        size_mb: 37888,
      },
      {
        id: 'gutenberg_en_lcc-n',
        version: '2026-03',
        title: 'Project Gutenberg: Fine Arts (LCC N)',
        description: 'Public-domain visual arts, design, and fine-arts writing under LCC N',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_lcc-n_2026-03.zim',
        size_mb: 21504,
      },
      {
        id: 'gutenberg_en_lcc-p',
        version: '2026-03',
        title: 'Project Gutenberg: Language Studies (LCC P)',
        description: 'Compact language and philology material grouped under LCC P',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_lcc-p_2026-03.zim',
        size_mb: 37,
      },
      {
        id: 'gutenberg_en_all',
        version: '2025-11',
        title: 'Project Gutenberg: Full English Mirror',
        description: 'The giant public-domain English shelf for machines that want the whole thing locally',
        url: 'https://download.kiwix.org/zim/gutenberg/gutenberg_en_all_2025-11.zim',
        size_mb: 210944,
      },
    ],
  },
  {
    category: 'agriculture',
    tier: {
      name: 'Comprehensive',
      slug: 'agriculture-comprehensive',
      description: 'A deeper practical shelf for growing, preserving, and making. Includes Standard.',
      includesTier: 'agriculture-standard',
    },
    resources: [
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Comprehensive',
      slug: 'science-simulations-comprehensive',
      description: 'Specialized scientific reference for longer study sessions. Includes Standard.',
      includesTier: 'science-simulations-standard',
    },
    resources: [
      {
        id: 'space.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Space Exploration Q&A',
        description: 'Spaceflight, missions, launch systems, and practical space-ops discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/space.stackexchange.com_en_all_2026-02.zim',
        size: '380M',
      },
      {
        id: 'bioacoustics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Bioacoustics Q&A',
        description: 'Animal sound, acoustic analysis, and sound-in-nature research questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/bioacoustics.stackexchange.com_en_all_2026-02.zim',
        size: '9.3M',
      },
      {
        id: 'medicalsciences.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Medical Sciences Q&A',
        description: 'Research and study discussion around medicine, physiology, and biomedical science',
        url: 'https://download.kiwix.org/zim/stack_exchange/medicalsciences.stackexchange.com_en_all_2026-02.zim',
        size: '58M',
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Standard',
      slug: 'maker-electronics-standard',
      description: 'Add maker staples for boards, embedded work, and bench-side debugging. Includes Essential.',
      includesTier: 'maker-electronics-essential',
    },
    resources: [
      {
        id: 'arduino.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Arduino Q&A',
        description: 'Boards, sketches, sensors, shields, and microcontroller troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/arduino.stackexchange.com_en_all_2026-02.zim',
        size: '247M',
      },
      {
        id: 'robotics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Robotics Q&A',
        description: 'Robotics hardware, motion, sensors, and control-stack discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/robotics.stackexchange.com_en_all_2026-02.zim',
        size: '233M',
      },
      {
        id: 'iot.stackexchange.com_en_all',
        version: '2026-02',
        title: 'IoT Q&A',
        description: 'Embedded connectivity, edge devices, and networked hardware workflows',
        url: 'https://download.kiwix.org/zim/stack_exchange/iot.stackexchange.com_en_all_2026-02.zim',
        size: '19M',
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Comprehensive',
      slug: 'maker-electronics-comprehensive',
      description: 'The heavier bench shelf for circuit work, radio, and practical machine repair. Includes Standard.',
      includesTier: 'maker-electronics-standard',
    },
    resources: [
      {
        id: 'electronics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Electronics Q&A',
        description: 'Circuit analysis, components, power, analog, digital, and bench troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/electronics.stackexchange.com_en_all_2026-02.zim',
        size: '3.9G',
      },
      {
        id: 'ham.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Ham Radio Q&A',
        description: 'Radio gear, antennas, licensing, and field communication questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/ham.stackexchange.com_en_all_2026-02.zim',
        size: '72M',
      },
      {
        id: 'mechanics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Mechanics Q&A',
        description: 'Physical machine repair, moving parts, and wrench-first troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/mechanics.stackexchange.com_en_all_2026-02.zim',
        size: '323M',
      },
    ],
  },
  {
    category: 'design-visual-media',
    tier: {
      name: 'Comprehensive',
      slug: 'design-visual-media-comprehensive',
      description: 'A broader visual-production shelf for stills, motion, and layout craft. Includes Standard.',
      includesTier: 'design-visual-media-standard',
    },
    resources: [
      {
        id: 'graphicdesign.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Graphic Design Q&A',
        description: 'Typography, layout, branding, print, and visual-design workflow reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/graphicdesign.stackexchange.com_en_all_2026-02.zim',
        size: '884M',
      },
      {
        id: 'photo.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Photography Q&A',
        description: 'Cameras, exposure, lenses, workflow, and real-world image-making questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/photo.stackexchange.com_en_all_2026-02.zim',
        size: '431M',
      },
      {
        id: 'video.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Video Production Q&A',
        description: 'Editing, codecs, cameras, color, and video workflow troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/video.stackexchange.com_en_all_2026-02.zim',
        size: '73M',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Comprehensive',
      slug: 'computing-comprehensive',
      description: 'Fill out the language shelf with systems-level references and cloud-native runtime docs. Includes Standard.',
      includesTier: 'computing-standard',
    },
    resources: [
      {
        id: 'softwareengineering.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Software Engineering Q&A',
        description: 'Architecture, maintainability, project structure, and team-scale engineering discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/softwareengineering.stackexchange.com_en_all_2026-02.zim',
        size: '457M',
      },
      {
        id: 'opensource.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Open Source Q&A',
        description: 'Licensing, maintainer workflow, open collaboration, and project stewardship questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/opensource.stackexchange.com_en_all_2026-02.zim',
        size: '29M',
      },
      {
        id: 'devdocs_en_react',
        version: '2026-02',
        title: 'React Docs',
        description: 'Core React reference for components, hooks, rendering, and modern app structure',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_react_2026-02.zim',
        size: '2.6M',
      },
      {
        id: 'devdocs_en_node',
        version: '2026-02',
        title: 'Node.js Docs',
        description: 'Runtime APIs, modules, streams, and server-side JavaScript reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_node_2026-02.zim',
        size: '1.3M',
      },
      {
        id: 'devdocs_en_go',
        version: '2026-04',
        title: 'Go Docs',
        description: 'Language and standard-library reference for Go development inside the vault',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_go_2026-04.zim',
        size: '1.6M',
      },
      {
        id: 'devdocs_en_rust',
        version: '2026-04',
        title: 'Rust Docs',
        description: 'Rust language and library reference for safer systems work',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_rust_2026-04.zim',
        size: '5.7M',
      },
      {
        id: 'cheatography.com_en_all',
        version: '2025-07',
        title: 'Cheatography',
        description: 'A giant cheat-sheet shelf for coding, ops, design, and day-to-day terminal work',
        url: 'https://download.kiwix.org/zim/zimit/cheatography.com_en_all_2025-07.zim',
        size: '11G',
      },
    ],
  },
  {
    category: 'diy',
    tier: {
      name: 'Comprehensive',
      slug: 'diy-comprehensive',
      description: 'Adds craft and hands-on making reference once the core repair shelf is already in place. Includes Standard.',
      includesTier: 'diy-standard',
    },
    resources: [
      {
        id: 'crafts.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Crafts Q&A',
        description: 'Sewing, leather, handmaking, materials, and practical craft problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/crafts.stackexchange.com_en_all_2026-02.zim',
        size: '54M',
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Comprehensive',
      slug: 'science-simulations-comprehensive',
      description: 'Specialized scientific reference for longer study sessions. Includes Standard.',
      includesTier: 'science-simulations-standard',
    },
    resources: [
      {
        id: 'earthscience.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Earth Science Q&A',
        description: 'Geology, weather, climate, and earth-systems discussion for field-minded science work',
        url: 'https://download.kiwix.org/zim/stack_exchange/earthscience.stackexchange.com_en_all_2026-02.zim',
        size: '126M',
      },
      {
        id: 'engineering.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Engineering Q&A',
        description: 'Mechanics, materials, structures, and applied engineering problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/engineering.stackexchange.com_en_all_2026-02.zim',
        size: '242M',
      },
      {
        id: 'avanti-concepts-of-chemistry',
        version: '2025-09',
        title: 'Avanti: Concepts of Chemistry',
        description: 'A chemistry video shelf with concept-first explanations and classroom pacing',
        url: 'https://download.kiwix.org/zim/videos/avanti-concepts-of-chemistry_2025-09.zim',
        size: '213M',
      },
      {
        id: 'avanti-electrochemistry',
        version: '2025-09',
        title: 'Avanti: Electrochemistry',
        description: 'A focused electrochemistry video shelf for reactions, cells, and applied chemistry concepts',
        url: 'https://download.kiwix.org/zim/videos/avanti-electrochemistry_2025-09.zim',
        size: '113M',
      },
      {
        id: 'avanti-surface-chemistry',
        version: '2025-09',
        title: 'Avanti: Surface Chemistry',
        description: 'Video lessons on adsorption, colloids, and surface-chemistry fundamentals',
        url: 'https://download.kiwix.org/zim/videos/avanti-surface-chemistry_2025-09.zim',
        size: '115M',
      },
    ],
  },
  {
    category: 'maker-electronics',
    tier: {
      name: 'Standard',
      slug: 'maker-electronics-standard',
      description: 'Add fabrication and object-making context once the bench basics are in place. Includes Essential.',
      includesTier: 'maker-electronics-essential',
    },
    resources: [
      {
        id: '3dprinting.stackexchange.com_en_all',
        version: '2026-02',
        title: '3D Printing Q&A',
        description: 'Printers, slicers, materials, tolerances, and fabrication troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/3dprinting.stackexchange.com_en_all_2026-02.zim',
        size: '115M',
      },
    ],
  },
  {
    category: 'design-visual-media',
    tier: {
      name: 'Standard',
      slug: 'design-visual-media-standard',
      description: 'Bring in 3D production thinking and Blender-specific problem-solving. Includes Essential.',
      includesTier: 'design-visual-media-essential',
    },
    resources: [
      {
        id: 'computergraphics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Computer Graphics Q&A',
        description: 'Rendering, shading, transforms, rasterization, and graphics pipeline discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/computergraphics.stackexchange.com_en_all_2026-02.zim',
        size: '51M',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Comprehensive',
      slug: 'computing-comprehensive',
      description: 'Fill out the language shelf with systems-level references and cloud-native runtime docs. Includes Standard.',
      includesTier: 'computing-standard',
    },
    resources: [
      {
        id: 'codereview.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Code Review Q&A',
        description: 'Code critique, refactoring advice, and design tradeoff discussion across languages',
        url: 'https://download.kiwix.org/zim/stack_exchange/codereview.stackexchange.com_en_all_2026-02.zim',
        size: '525M',
      },
      {
        id: 'cs.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Computer Science Q&A',
        description: 'Algorithms, data structures, complexity, and practical CS-heavy reasoning',
        url: 'https://download.kiwix.org/zim/stack_exchange/cs.stackexchange.com_en_all_2026-02.zim',
        size: '264M',
      },
      {
        id: 'cstheory.stackexchange.com_en_all',
        version: '2026-02',
        title: 'CS Theory Q&A',
        description: 'Formal methods, theory, proofs, and deeper computational thinking',
        url: 'https://download.kiwix.org/zim/stack_exchange/cstheory.stackexchange.com_en_all_2026-02.zim',
        size: '71M',
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Standard',
      slug: 'it-infrastructure-standard',
      description: 'Add web and edge-infrastructure learning once the Linux base shelf is in place. Includes Essential.',
      includesTier: 'it-infrastructure-essential',
    },
    resources: [
      {
        id: 'android.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Android Q&A',
        description: 'Android setup, modding, troubleshooting, and device-management reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/android.stackexchange.com_en_all_2026-02.zim',
        size: '392M',
      },
      {
        id: 'dba.stackexchange.com_en_all',
        version: '2026-02',
        title: 'DBA Q&A',
        description: 'Database administration, tuning, replication, and query-ops reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/dba.stackexchange.com_en_all_2026-02.zim',
        size: '669M',
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Comprehensive',
      slug: 'it-infrastructure-comprehensive',
      description: 'Pull in the broader security shelf once you want more context around threat models and defensive ops. Includes Standard.',
      includesTier: 'it-infrastructure-standard',
    },
    resources: [
      {
        id: 'devops.stackexchange.com_en_all',
        version: '2026-02',
        title: 'DevOps Q&A',
        description: 'Pipelines, observability, release flow, and infra automation discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/devops.stackexchange.com_en_all_2026-02.zim',
        size: '33M',
      },
    ],
  },
  {
    category: 'kids-family',
    tier: {
      name: 'Essential',
      slug: 'kids-family-essential',
      description: 'Start with the compact youth encyclopedia shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'vikidia_en_all_nopic',
        version: '2026-03',
        title: 'Vikidia English',
        description: 'A kid-friendly general encyclopedia sized for fast installs and easy offline browsing',
        url: 'https://download.kiwix.org/zim/vikidia/vikidia_en_all_nopic_2026-03.zim',
        size: '8.2M',
      },
    ],
  },
  {
    category: 'kids-family',
    tier: {
      name: 'Standard',
      slug: 'kids-family-standard',
      description: 'Add a larger reading and story shelf for family and youth installs. Includes Essential.',
      includesTier: 'kids-family-essential',
    },
    resources: [
      {
        id: 'africanstorybook.org_mul_all',
        version: '2025-01',
        title: 'African Storybook',
        description: 'A large multilingual shelf of illustrated stories and reading material for younger learners',
        url: 'https://download.kiwix.org/zim/other/africanstorybook.org_mul_all_2025-01.zim',
        size: '8.1G',
      },
    ],
  },
  {
    category: 'open-courses',
    tier: {
      name: 'Essential',
      slug: 'open-courses-essential',
      description: 'Compact study shelves for math, pedagogy, and structured self-teaching.',
      recommended: true,
    },
    resources: [
      {
        id: 'artofproblemsolving_en_all_maxi',
        version: '2021-03',
        title: 'Art of Problem Solving',
        description: 'Problem-solving, contest math, and rigorous worked explanations in one compact shelf',
        url: 'https://download.kiwix.org/zim/other/artofproblemsolving_en_all_maxi_2021-03.zim',
        size: '196M',
      },
      {
        id: 'edutechwiki_en_all_maxi',
        version: '2026-01',
        title: 'EdutechWiki',
        description: 'Learning design, pedagogy, and educational-technology reference',
        url: 'https://download.kiwix.org/zim/other/edutechwiki_en_all_maxi_2026-01.zim',
        size: '57M',
      },
      {
        id: 'milneopentextbooks.org_en_all',
        version: '2026-02',
        title: 'Milne Open Textbooks',
        description: 'Open college textbooks spanning math, sciences, and general course material',
        url: 'https://download.kiwix.org/zim/zimit/milneopentextbooks.org_en_all_2026-02.zim',
        size: '703M',
      },
      {
        id: 'planetmath.org_en_all',
        version: '2026-02',
        title: 'PlanetMath',
        description: 'Math reference and concept explanations for proofs, notation, and definitions',
        url: 'https://download.kiwix.org/zim/zimit/planetmath.org_en_all_2026-02.zim',
        size: '38M',
      },
    ],
  },
  {
    category: 'open-courses',
    tier: {
      name: 'Standard',
      slug: 'open-courses-standard',
      description: 'A larger lecture shelf for broad subject walks and study-by-watching. Includes Essential.',
      includesTier: 'open-courses-essential',
    },
    resources: [
      {
        id: 'crashcourse_en_all',
        version: '2026-02',
        title: 'Crash Course',
        description: 'Fast-moving video explainers across history, science, literature, philosophy, and more',
        url: 'https://download.kiwix.org/zim/other/crashcourse_en_all_2026-02.zim',
        size: '21G',
      },
      {
        id: 'stacks.math.columbia.edu_en_all',
        version: '2025-06',
        title: 'Stacks Project',
        description: 'A deep algebraic-geometry and proof-heavy math shelf for serious study',
        url: 'https://download.kiwix.org/zim/zimit/stacks.math.columbia.edu_en_all_2025-06.zim',
        size: '147M',
      },
    ],
  },
  {
    category: 'open-courses',
    tier: {
      name: 'Comprehensive',
      slug: 'open-courses-comprehensive',
      description: 'The giant open-course archive for machines with serious storage to spare. Includes Standard.',
      includesTier: 'open-courses-standard',
    },
    resources: [
      {
        id: 'khanacademy_en_all',
        version: '2023-03',
        title: 'Khan Academy',
        description: 'A very large open course shelf across math, science, economics, computing, and test prep',
        url: 'https://download.kiwix.org/zim/other/khanacademy_en_all_2023-03.zim',
        size: '168G',
      },
    ],
  },
  {
    category: 'law-history-society',
    tier: {
      name: 'Essential',
      slug: 'law-history-society-essential',
      description: 'Start with the civic and historical core.',
      recommended: true,
    },
    resources: [
      {
        id: 'law.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Law Q&A',
        description: 'Legal principles, procedure, and practical law-focused problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/law.stackexchange.com_en_all_2026-02.zim',
        size: '176M',
      },
      {
        id: 'politics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Politics Q&A',
        description: 'Government systems, policy, elections, and civics discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/politics.stackexchange.com_en_all_2026-02.zim',
        size: '199M',
      },
      {
        id: 'history.stackexchange.com_en_all',
        version: '2026-02',
        title: 'History Q&A',
        description: 'Historical context, source interpretation, and history-heavy research discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/history.stackexchange.com_en_all_2026-02.zim',
        size: '304M',
      },
    ],
  },
  {
    category: 'law-history-society',
    tier: {
      name: 'Standard',
      slug: 'law-history-society-standard',
      description: 'Add the philosophy, economics, and work-life side of the shelf. Includes Essential.',
      includesTier: 'law-history-society-essential',
    },
    resources: [
      {
        id: 'philosophy.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Philosophy Q&A',
        description: 'Arguments, schools of thought, ethics, metaphysics, and careful reasoning',
        url: 'https://download.kiwix.org/zim/stack_exchange/philosophy.stackexchange.com_en_all_2026-02.zim',
        size: '198M',
      },
      {
        id: 'economics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Economics Q&A',
        description: 'Micro, macro, incentives, and policy discussion for the practical side of economics',
        url: 'https://download.kiwix.org/zim/stack_exchange/economics.stackexchange.com_en_all_2026-02.zim',
        size: '109M',
      },
      {
        id: 'workplace.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Workplace Q&A',
        description: 'Jobs, office dynamics, professional communication, and workplace strategy',
        url: 'https://download.kiwix.org/zim/stack_exchange/workplace.stackexchange.com_en_all_2026-02.zim',
        size: '234M',
      },
    ],
  },
  {
    category: 'law-history-society',
    tier: {
      name: 'Comprehensive',
      slug: 'law-history-society-comprehensive',
      description: 'A broader civic memory lane for current-events context and historical drift. Includes Standard.',
      includesTier: 'law-history-society-standard',
    },
    resources: [
      {
        id: 'wikinews_en_all_nopic',
        version: '2026-01',
        title: 'Wikinews English',
        description: 'A compact current-events archive for headlines, topics, and event context',
        url: 'https://download.kiwix.org/zim/wikinews/wikinews_en_all_nopic_2026-01.zim',
        size: '65M',
      },
    ],
  },
  {
    category: 'language-writing',
    tier: {
      name: 'Essential',
      slug: 'language-writing-essential',
      description: 'Start with English usage and learner-focused language help.',
      recommended: true,
    },
    resources: [
      {
        id: 'english.stackexchange.com_en_all',
        version: '2026-02',
        title: 'English Language Q&A',
        description: 'Usage, grammar, etymology, and style discussion for heavy reading and editing work',
        url: 'https://download.kiwix.org/zim/stack_exchange/english.stackexchange.com_en_all_2026-02.zim',
        size: '730M',
      },
      {
        id: 'ell.stackexchange.com_en_all',
        version: '2026-02',
        title: 'English Learners Q&A',
        description: 'Language-learning explanations and practical support for people learning English',
        url: 'https://download.kiwix.org/zim/stack_exchange/ell.stackexchange.com_en_all_2026-02.zim',
        size: '450M',
      },
    ],
  },
  {
    category: 'language-writing',
    tier: {
      name: 'Standard',
      slug: 'language-writing-standard',
      description: 'Add writing craft and language-study shelves. Includes Essential.',
      includesTier: 'language-writing-essential',
    },
    resources: [
      {
        id: 'linguistics.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Linguistics Q&A',
        description: 'Phonetics, syntax, semantics, and language-structure discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/linguistics.stackexchange.com_en_all_2026-02.zim',
        size: '82M',
      },
      {
        id: 'literature.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Literature Q&A',
        description: 'Interpretation, close reading, genre, and literary reference discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/literature.stackexchange.com_en_all_2026-02.zim',
        size: '68M',
      },
      {
        id: 'writing.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Writing Q&A',
        description: 'Story craft, prose, editing, structure, and publishing-minded writing advice',
        url: 'https://download.kiwix.org/zim/stack_exchange/writing.stackexchange.com_en_all_2026-02.zim',
        size: '96M',
      },
    ],
  },
  {
    category: 'language-writing',
    tier: {
      name: 'Comprehensive',
      slug: 'language-writing-comprehensive',
      description: 'The broader quote and literary-reference shelf for reading-heavy installs. Includes Standard.',
      includesTier: 'language-writing-standard',
    },
    resources: [
      {
        id: 'wikiquote_en_all_nopic',
        version: '2026-01',
        title: 'English Wikiquote',
        description: 'A quote archive across authors, works, public figures, and cultural reference points',
        url: 'https://download.kiwix.org/zim/wikiquote/wikiquote_en_all_nopic_2026-01.zim',
        size: '303M',
      },
      {
        id: 'folgerpedia.folger.edu_en_all',
        version: '2026-03',
        title: 'Folgerpedia',
        description: 'A deep Shakespeare and early-modern literature shelf from the Folger collection',
        url: 'https://download.kiwix.org/zim/other/folgerpedia.folger.edu_en_all_2026-03.zim',
        size: '3.9G',
      },
    ],
  },
  {
    category: 'finance-crypto',
    tier: {
      name: 'Essential',
      slug: 'finance-crypto-essential',
      description: 'Start with the compact money and investing shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'finiki_en_all_maxi',
        version: '2024-06',
        title: 'Finiki',
        description: 'A compact investing and personal-finance wiki for long-range planning',
        url: 'https://download.kiwix.org/zim/other/finiki_en_all_maxi_2024-06.zim',
        size: '3.9M',
      },
      {
        id: 'bogleheads_en_all_maxi',
        version: '2025-11',
        title: 'Bogleheads',
        description: 'Index-fund, retirement, and long-horizon investing reference in one tight shelf',
        url: 'https://download.kiwix.org/zim/other/bogleheads_en_all_maxi_2025-11.zim',
        size: '10M',
      },
    ],
  },
  {
    category: 'finance-crypto',
    tier: {
      name: 'Standard',
      slug: 'finance-crypto-standard',
      description: 'Add practical money and economic Q&A once the base shelf is in place. Includes Essential.',
      includesTier: 'finance-crypto-essential',
    },
    resources: [
      {
        id: 'money.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Money Q&A',
        description: 'Personal finance, taxes, banking, and real-world money problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/money.stackexchange.com_en_all_2026-02.zim',
        size: '242M',
      },
    ],
  },
  {
    category: 'finance-crypto',
    tier: {
      name: 'Comprehensive',
      slug: 'finance-crypto-comprehensive',
      description: 'Pull in the crypto shelf once you want market, protocol, and wallet context too. Includes Standard.',
      includesTier: 'finance-crypto-standard',
    },
    resources: [
      {
        id: 'bitcoin_en_all_maxi',
        version: '2021-03',
        title: 'Bitcoin Wiki',
        description: 'A compact cryptocurrency and protocol shelf with wallet, mining, and ecosystem reference',
        url: 'https://download.kiwix.org/zim/other/bitcoin_en_all_maxi_2021-03.zim',
        size: '17M',
      },
      {
        id: 'bitcoin.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Bitcoin Q&A',
        description: 'Protocol, wallets, security, transactions, and practical crypto troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/bitcoin.stackexchange.com_en_all_2026-02.zim',
        size: '149M',
      },
    ],
  },
  {
    category: 'travel-mobility-outdoors',
    tier: {
      name: 'Essential',
      slug: 'travel-mobility-outdoors-essential',
      description: 'Start with the practical travel and moving-around shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'travel.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Travel Q&A',
        description: 'Visas, routes, timing, safety, and the practical realities of getting somewhere',
        url: 'https://download.kiwix.org/zim/stack_exchange/travel.stackexchange.com_en_all_2026-02.zim',
        size: '439M',
      },
      {
        id: 'expatriates.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Expatriates Q&A',
        description: 'Living abroad, documents, work, housing, and day-to-day logistics far from home',
        url: 'https://download.kiwix.org/zim/stack_exchange/expatriates.stackexchange.com_en_all_2026-02.zim',
        size: '40M',
      },
      {
        id: 'hitchwiki_en_all_maxi',
        version: '2023-01',
        title: 'Hitchwiki',
        description: 'Route notes, local advice, and practical traveler knowledge from the road',
        url: 'https://download.kiwix.org/zim/other/hitchwiki_en_all_maxi_2023-01.zim',
        size: '16M',
      },
    ],
  },
  {
    category: 'travel-mobility-outdoors',
    tier: {
      name: 'Standard',
      slug: 'travel-mobility-outdoors-standard',
      description: 'Add outdoors and machine-assisted movement once the basic travel shelf is in place. Includes Essential.',
      includesTier: 'travel-mobility-outdoors-essential',
    },
    resources: [
      {
        id: 'outdoors.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Outdoors Q&A',
        description: 'Camping, hiking, navigation, kit choices, and wilderness decision-making',
        url: 'https://download.kiwix.org/zim/stack_exchange/outdoors.stackexchange.com_en_all_2026-02.zim',
        size: '136M',
      },
      {
        id: 'aviation.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Aviation Q&A',
        description: 'Flying, aircraft systems, navigation, and aviation know-how',
        url: 'https://download.kiwix.org/zim/stack_exchange/aviation.stackexchange.com_en_all_2026-02.zim',
        size: '482M',
      },
      {
        id: 'bicycles.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Bicycles Q&A',
        description: 'Bike maintenance, fit, route gear, and practical cycling problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/bicycles.stackexchange.com_en_all_2026-02.zim',
        size: '467M',
      },
    ],
  },
  {
    category: 'travel-mobility-outdoors',
    tier: {
      name: 'Comprehensive',
      slug: 'travel-mobility-outdoors-comprehensive',
      description: 'The broader mobility shelf for more specialized movement and navigation contexts. Includes Standard.',
      includesTier: 'travel-mobility-outdoors-standard',
    },
    resources: [
      {
        id: 'drones.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Drones Q&A',
        description: 'Drone flight, equipment, regulations, and aerial workflow troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/drones.stackexchange.com_en_all_2026-02.zim',
        size: '12M',
      },
    ],
  },
  {
    category: 'games-pop-culture',
    tier: {
      name: 'Essential',
      slug: 'games-pop-culture-essential',
      description: 'Start with film and anime reference before the bigger fandom shelves.',
      recommended: true,
    },
    resources: [
      {
        id: 'movies.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Movies Q&A',
        description: 'Film trivia, production details, plot questions, and movie reference discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/movies.stackexchange.com_en_all_2026-02.zim',
        size: '271M',
      },
      {
        id: 'anime.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Anime & Manga Q&A',
        description: 'Anime, manga, continuity, fandom, and series-specific reference discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/anime.stackexchange.com_en_all_2026-02.zim',
        size: '228M',
      },
    ],
  },
  {
    category: 'games-pop-culture',
    tier: {
      name: 'Standard',
      slug: 'games-pop-culture-standard',
      description: 'Add gaming shelves once the screen-side culture lane is already in place. Includes Essential.',
      includesTier: 'games-pop-culture-essential',
    },
    resources: [
      {
        id: 'gaming.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Gaming Q&A',
        description: 'Gameplay systems, platform issues, mechanics, and game-specific troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/gaming.stackexchange.com_en_all_2026-02.zim',
        size: '771M',
      },
      {
        id: 'boardgames.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Board Games Q&A',
        description: 'Rules, strategy, edge cases, and tabletop reference for physical games',
        url: 'https://download.kiwix.org/zim/stack_exchange/boardgames.stackexchange.com_en_all_2026-02.zim',
        size: '102M',
      },
    ],
  },
  {
    category: 'games-pop-culture',
    tier: {
      name: 'Comprehensive',
      slug: 'games-pop-culture-comprehensive',
      description: 'The deeper genre and worldbuilding shelf for machines that keep culture close. Includes Standard.',
      includesTier: 'games-pop-culture-standard',
    },
    resources: [
      {
        id: 'scifi.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Sci-Fi & Fantasy Q&A',
        description: 'Lore, continuity, franchises, speculative fiction, and genre reference discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/scifi.stackexchange.com_en_all_2026-02.zim',
        size: '1.2G',
      },
      {
        id: 'worldbuilding.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Worldbuilding Q&A',
        description: 'Designing believable worlds, systems, settings, and speculative structures',
        url: 'https://download.kiwix.org/zim/stack_exchange/worldbuilding.stackexchange.com_en_all_2026-02.zim',
        size: '797M',
      },
      {
        id: 'explainxkcd_en_all_maxi',
        version: '2026-02',
        title: 'Explain XKCD',
        description: 'A compact culture-and-science side shelf for decoding XKCD comics and references',
        url: 'https://download.kiwix.org/zim/other/explainxkcd_en_all_maxi_2026-02.zim',
        size: '151M',
      },
    ],
  },
  {
    category: 'homestead-sustainability',
    tier: {
      name: 'Essential',
      slug: 'homestead-sustainability-essential',
      description: 'Start with the practical sustainability shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'appropedia_en_all_maxi',
        version: '2026-02',
        title: 'Appropedia',
        description: 'Practical sustainability, appropriate technology, repair, and self-reliance reference',
        url: 'https://download.kiwix.org/zim/other/appropedia_en_all_maxi_2026-02.zim',
        size: '555M',
      },
    ],
  },
  {
    category: 'homestead-sustainability',
    tier: {
      name: 'Standard',
      slug: 'homestead-sustainability-standard',
      description: 'Add energy and growing context once the core self-reliance shelf is in place. Includes Essential.',
      includesTier: 'homestead-sustainability-essential',
    },
    resources: [
      {
        id: 'energypedia_en_all_maxi',
        version: '2025-12',
        title: 'Energypedia',
        description: 'Energy systems, electrification, infrastructure, and field-heavy sustainability reference',
        url: 'https://download.kiwix.org/zim/other/energypedia_en_all_maxi_2025-12.zim',
        size: '762M',
      },
      {
        id: 'gardening.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Gardening Q&A',
        description: 'Garden planning, plant care, soils, pests, and practical growing advice',
        url: 'https://download.kiwix.org/zim/stack_exchange/gardening.stackexchange.com_en_all_2026-02.zim',
        size: '882M',
      },
    ],
  },
  {
    category: 'homestead-sustainability',
    tier: {
      name: 'Comprehensive',
      slug: 'homestead-sustainability-comprehensive',
      description: 'The broader hand-built shelf once the basics are already sitting in the vault. Includes Standard.',
      includesTier: 'homestead-sustainability-standard',
    },
    resources: [
      {
        id: 'crafts.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Crafts Q&A',
        description: 'Sewing, leather, handmaking, materials, and practical craft problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/crafts.stackexchange.com_en_all_2026-02.zim',
        size: '54M',
      },
    ],
  },
  {
    category: 'open-courses',
    tier: {
      name: 'Standard',
      slug: 'open-courses-standard',
      description: 'Add broader study tracks, digital-skills shelves, and serious self-teaching material. Includes Essential.',
      includesTier: 'open-courses-essential',
    },
    resources: [
      {
        id: 'edu.gcfglobal.org_en_all',
        version: '2025-03',
        title: 'GCFGlobal',
        description: 'Digital skills, office basics, career prep, and approachable technology lessons',
        url: 'https://download.kiwix.org/zim/zimit/edu.gcfglobal.org_en_all_2025-03.zim',
        size: '515M',
      },
      {
        id: 'htdp.org_en_all',
        version: '2026-02',
        title: 'How to Design Programs',
        description: 'A structured programming-course shelf centered on design recipes and fundamentals',
        url: 'https://download.kiwix.org/zim/zimit/htdp.org_en_all_2026-02.zim',
        size: '1.9M',
      },
    ],
  },
  {
    category: 'open-courses',
    tier: {
      name: 'Comprehensive',
      slug: 'open-courses-comprehensive',
      description: 'The deeper lecture and study shelf once the main course lane is already in place. Includes Standard.',
      includesTier: 'open-courses-standard',
    },
    resources: [
      {
        id: 'ethanweed_en_all',
        version: '2025-11',
        title: 'Ethan Weed',
        description: 'Compact psychology and research-method lessons for study sessions that want a tighter scope',
        url: 'https://download.kiwix.org/zim/zimit/ethanweed_en_all_2025-11.zim',
        size: '8.0M',
      },
    ],
  },
  {
    category: 'kids-family',
    tier: {
      name: 'Standard',
      slug: 'kids-family-standard',
      description: 'Bring in family-oriented shelves and parenting reference once the lighter study lane is in place. Includes Essential.',
      includesTier: 'kids-family-essential',
    },
    resources: [
      {
        id: 'parenting.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Parenting Q&A',
        description: 'Parenting questions, age-stage advice, and practical family problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/parenting.stackexchange.com_en_all_2026-02.zim',
        size: '57M',
      },
    ],
  },
  {
    category: 'kids-family',
    tier: {
      name: 'Comprehensive',
      slug: 'kids-family-comprehensive',
      description: 'The large family shelf for longer-lived installs and shared machines. Includes Standard.',
      includesTier: 'kids-family-standard',
    },
    resources: [
      {
        id: 'booksdash_en_all',
        version: '2024-06',
        title: 'Book Dash',
        description: 'A large open children’s-book shelf for shared devices, reading corners, and family setups',
        url: 'https://download.kiwix.org/zim/zimit/booksdash_en_all_2024-06.zim',
        size: '11G',
      },
    ],
  },
  {
    category: 'law-history-society',
    tier: {
      name: 'Comprehensive',
      slug: 'law-history-society-comprehensive',
      description: 'The deeper context shelf for institutions, philosophy, and civic life. Includes Standard.',
      includesTier: 'law-history-society-standard',
    },
    resources: [
      {
        id: 'internet-encyclopedia-philosophy_en_all',
        version: '2025-11',
        title: 'Internet Encyclopedia of Philosophy',
        description: 'A serious philosophy shelf with primary concepts, movements, and deep article-style reference',
        url: 'https://download.kiwix.org/zim/zimit/internet-encyclopedia-philosophy_en_all_2025-11.zim',
        size: '123M',
      },
      {
        id: 'citizensinformation.ie_en_all',
        version: '2026-03',
        title: 'Citizens Information',
        description: 'Public-service, rights, benefits, and civic-process reference written for everyday use',
        url: 'https://download.kiwix.org/zim/zimit/citizensinformation.ie_en_all_2026-03.zim',
        size: '128M',
      },
      {
        id: 'citizendium.org_en_all_maxi',
        version: '2026-01',
        title: 'Citizendium',
        description: 'A compact general-reference shelf with a more old-web encyclopedic feel',
        url: 'https://download.kiwix.org/zim/other/citizendium.org_en_all_maxi_2026-01.zim',
        size: '209M',
      },
    ],
  },
  {
    category: 'language-writing',
    tier: {
      name: 'Comprehensive',
      slug: 'language-writing-comprehensive',
      description: 'Bring in the broader language-study and language-design shelf. Includes Standard.',
      includesTier: 'language-writing-standard',
    },
    resources: [
      {
        id: 'languagelearning.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Language Learning Q&A',
        description: 'Language-study methods, drills, retention, and learning workflow discussions',
        url: 'https://download.kiwix.org/zim/stack_exchange/languagelearning.stackexchange.com_en_all_2026-02.zim',
        size: '11M',
      },
      {
        id: 'conlang.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Conlang Q&A',
        description: 'Constructed language design, grammar invention, and world-language experimentation',
        url: 'https://download.kiwix.org/zim/stack_exchange/conlang.stackexchange.com_en_all_2026-02.zim',
        size: '7.1M',
      },
      {
        id: 'langdev.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Language Design Q&A',
        description: 'Programming-language design, compilers, syntax decisions, and language-theory reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/langdev.stackexchange.com_en_all_2026-02.zim',
        size: '10M',
      },
    ],
  },
  {
    category: 'finance-crypto',
    tier: {
      name: 'Comprehensive',
      slug: 'finance-crypto-comprehensive',
      description: 'The heavier money-and-crypto shelf for people who want a broader finance brain in the vault. Includes Standard.',
      includesTier: 'finance-crypto-standard',
    },
    resources: [
      {
        id: 'crypto.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Cryptography Q&A',
        description: 'Applied cryptography, protocols, primitives, and implementation questions',
        url: 'https://download.kiwix.org/zim/stack_exchange/crypto.stackexchange.com_en_all_2026-02.zim',
        size: '176M',
      },
      {
        id: 'quant.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Quantitative Finance Q&A',
        description: 'Pricing models, market math, derivatives, and quantitative-finance reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/quant.stackexchange.com_en_all_2026-02.zim',
        size: '153M',
      },
    ],
  },
  {
    category: 'agriculture',
    tier: {
      name: 'Standard',
      slug: 'agriculture-standard',
      description: 'Broaden the food and pantry lane with practical cooking and ingredient shelves. Includes Essential.',
      includesTier: 'agriculture-essential',
    },
    resources: [
      {
        id: 'based.cooking_en_all',
        version: '2026-02',
        title: 'Based Cooking',
        description: 'Straightforward recipes and cooking notes without the usual ad-soaked site nonsense',
        url: 'https://download.kiwix.org/zim/zimit/based.cooking_en_all_2026-02.zim',
        size: '15M',
      },
      {
        id: 'grimgrains_en_all',
        version: '2026-02',
        title: 'Grim Grains',
        description: 'Fermentation, grain work, bread-adjacent technique, and practical food process notes',
        url: 'https://download.kiwix.org/zim/zimit/grimgrains_en_all_2026-02.zim',
        size: '24M',
      },
      {
        id: 'cooking.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Cooking Q&A',
        description: 'Technique, substitutions, kitchen science, and practical cooking problem-solving',
        url: 'https://download.kiwix.org/zim/stack_exchange/cooking.stackexchange.com_en_all_2026-02.zim',
        size: '226M',
      },
    ],
  },
  {
    category: 'agriculture',
    tier: {
      name: 'Comprehensive',
      slug: 'agriculture-comprehensive',
      description: 'The deeper food shelf for ingredient-specific and lifestyle-specific reference. Includes Standard.',
      includesTier: 'agriculture-standard',
    },
    resources: [
      {
        id: 'vegetarianism.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Vegetarianism Q&A',
        description: 'Plant-based cooking, ingredient swaps, and nutrition-minded food discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/vegetarianism.stackexchange.com_en_all_2026-02.zim',
        size: '9.3M',
      },
      {
        id: 'coffee.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Coffee Q&A',
        description: 'Brewing, grinders, extraction, and bean workflow troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/coffee.stackexchange.com_en_all_2026-02.zim',
        size: '17M',
      },
      {
        id: 'alcohol.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Alcohol Q&A',
        description: 'Spirits, cocktails, beer, and practical beverage knowledge with low noise',
        url: 'https://download.kiwix.org/zim/stack_exchange/alcohol.stackexchange.com_en_all_2026-02.zim',
        size: '13M',
      },
    ],
  },
  {
    category: 'math-logic',
    tier: {
      name: 'Standard',
      slug: 'math-logic-standard',
      description: 'Add more proof drills, probability, and core course work once the first shelf is in place. Includes Essential.',
      includesTier: 'math-logic-essential',
    },
    resources: [
      {
        id: 'avanti-probability',
        version: '2025-09',
        title: 'Avanti: Probability',
        description: 'A focused probability course app with compact worked explanations and examples',
        url: 'https://download.kiwix.org/zim/videos/avanti-probability_2025-09.zim',
        size: '95M',
      },
      {
        id: 'avanti-trigonometry',
        version: '2025-09',
        title: 'Avanti: Trigonometry',
        description: 'A direct trigonometry shelf for identities, triangles, and analytic problem-solving',
        url: 'https://download.kiwix.org/zim/videos/avanti-trigonometry_2025-09.zim',
        size: '138M',
      },
    ],
  },
  {
    category: 'math-logic',
    tier: {
      name: 'Comprehensive',
      slug: 'math-logic-comprehensive',
      description: 'The deeper problem-solving lane for reasoning, vector work, and long study sessions. Includes Standard.',
      includesTier: 'math-logic-standard',
    },
    resources: [
      {
        id: 'avanti-mathematical-reasoning',
        version: '2025-09',
        title: 'Avanti: Mathematical Reasoning',
        description: 'A tighter reasoning shelf for proofs, logic flow, and clean problem structure',
        url: 'https://download.kiwix.org/zim/videos/avanti-mathematical-reasoning_2025-09.zim',
        size: '76M',
      },
      {
        id: 'avanti-vectors-and-calculus',
        version: '2025-09',
        title: 'Avanti: Vectors and Calculus',
        description: 'A denser vector-and-calculus shelf for motion, analysis, and worked derivations',
        url: 'https://download.kiwix.org/zim/videos/avanti-vectors-and-calculus_2025-09.zim',
        size: '236M',
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Comprehensive',
      slug: 'science-simulations-comprehensive',
      description: 'Pull in more earth, engineering, and physics depth once the base science lane is already healthy. Includes Standard.',
      includesTier: 'science-simulations-standard',
    },
    resources: [
      {
        id: 'earthscience.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Earth Science Q&A',
        description: 'Geology, climate, hazards, earth systems, and practical science discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/earthscience.stackexchange.com_en_all_2026-02.zim',
        size: '126M',
      },
      {
        id: 'engineering.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Engineering Q&A',
        description: 'A broad engineering problem shelf spanning statics, design, and practical build decisions',
        url: 'https://download.kiwix.org/zim/stack_exchange/engineering.stackexchange.com_en_all_2026-02.zim',
        size: '242M',
      },
      {
        id: 'avanti-wave-optics',
        version: '2025-09',
        title: 'Avanti: Wave Optics',
        description: 'A compact course app for interference, diffraction, and optics-heavy study',
        url: 'https://download.kiwix.org/zim/videos/avanti-wave-optics_2025-09.zim',
        size: '76M',
      },
      {
        id: 'avanti-work-power-energy',
        version: '2025-09',
        title: 'Avanti: Work, Power, and Energy',
        description: 'A practical mechanics shelf for core energy concepts and worked motion examples',
        url: 'https://download.kiwix.org/zim/videos/avanti-work-power-energy_2025-09.zim',
        size: '125M',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Standard',
      slug: 'computing-standard',
      description: 'Broaden the coding shelf with language docs, API work, and the practical tooling you actually reach for. Includes Essential.',
      includesTier: 'computing-essential',
    },
    resources: [
      {
        id: 'coreyms_en_python-tutorials',
        version: '2026-04',
        title: 'Corey Schafer: Python Tutorials',
        description: 'A full Python video lane for core syntax, everyday scripting, and practical workflows',
        url: 'https://download.kiwix.org/zim/videos/coreyms_en_python-tutorials_2026-04.zim',
        size: '2.0G',
      },
      {
        id: 'docs.python.org_en',
        version: '2025-09',
        title: 'Python Docs',
        description: 'The full Python documentation shelf for stdlib, language behavior, and reference work',
        url: 'https://download.kiwix.org/zim/zimit/docs.python.org_en_2025-09.zim',
        size: '2.3G',
      },
      {
        id: 'devdocs_en_git',
        version: '2026-04',
        title: 'Git Docs',
        description: 'Reference docs for Git commands, config, and version-control plumbing',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_git_2026-04.zim',
        size: '1.5M',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Comprehensive',
      slug: 'computing-comprehensive',
      description: 'A wider dev shelf for APIs, systems languages, editors, and data tooling. Includes Standard.',
      includesTier: 'computing-standard',
    },
    resources: [
      {
        id: 'devdocs_en_fastapi',
        version: '2026-04',
        title: 'FastAPI Docs',
        description: 'Python API and service-building reference for async apps and local tools',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_fastapi_2026-04.zim',
        size: '2.3M',
      },
      {
        id: 'devdocs_en_express',
        version: '2026-02',
        title: 'Express Docs',
        description: 'Node API and middleware reference for quick services and local backends',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_express_2026-02.zim',
        size: '433K',
      },
      {
        id: 'devdocs_en_django-rest-framework',
        version: '2026-04',
        title: 'Django REST Framework Docs',
        description: 'Serializer, API, and viewset reference for bigger Python service lanes',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_django-rest-framework_2026-04.zim',
        size: '585K',
      },
      {
        id: 'devdocs_en_c',
        version: '2026-04',
        title: 'C Docs',
        description: 'A compact C language and standard-library reference shelf',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_c_2026-04.zim',
        size: '1.2M',
      },
      {
        id: 'devdocs_en_cpp',
        version: '2026-04',
        title: 'C++ Docs',
        description: 'Templates, STL, and systems-language reference for lower-level coding work',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_cpp_2026-04.zim',
        size: '6.9M',
      },
      {
        id: 'devdocs_en_cmake',
        version: '2026-02',
        title: 'CMake Docs',
        description: 'Build-system reference for native projects, libraries, and toolchains',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_cmake_2026-02.zim',
        size: '2.5M',
      },
      {
        id: 'devdocs_en_duckdb',
        version: '2026-04',
        title: 'DuckDB Docs',
        description: 'Embedded analytics and local data-work reference for desktop-first tooling',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_duckdb_2026-04.zim',
        size: '1.9M',
      },
      {
        id: 'emacs.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Emacs Q&A',
        description: 'Editor workflows, Lisp tweaks, and long-session editing reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/emacs.stackexchange.com_en_all_2026-02.zim',
        size: '145M',
      },
    ],
  },
  {
    category: 'music-audio',
    tier: {
      name: 'Comprehensive',
      slug: 'music-audio-comprehensive',
      description: 'The deeper score-and-instrument shelf for long studio sessions and arrangement work. Includes Standard.',
      includesTier: 'music-audio-standard',
    },
    resources: [
      {
        id: 'ibanezwiki_en_all_maxi',
        version: '2024-06',
        title: 'Ibanez Wiki',
        description: 'Guitar model history, hardware details, and instrument-reference depth for gear-minded sessions',
        url: 'https://download.kiwix.org/zim/other/ibanezwiki_en_all_maxi_2024-06.zim',
        size: '154M',
      },
      {
        id: 'chopin.lib.uchicago.edu_en_all',
        version: '2025-01',
        title: 'Chopin Early Editions',
        description: 'A deep score and edition shelf for piano study, notation work, and classical reference',
        url: 'https://download.kiwix.org/zim/other/chopin.lib.uchicago.edu_en_all_2025-01.zim',
        size: '8.2G',
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Standard',
      slug: 'it-infrastructure-standard',
      description: 'Layer in container and platform docs once the core ops shelf is already in place. Includes Essential.',
      includesTier: 'it-infrastructure-essential',
    },
    resources: [
      {
        id: 'devdocs_en_docker',
        version: '2026-04',
        title: 'Docker Docs',
        description: 'Container workflows, images, Compose, and runtime reference for local stacks',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_docker_2026-04.zim',
        size: '1.7M',
      },
      {
        id: 'devdocs_en_kubernetes',
        version: '2026-04',
        title: 'Kubernetes Docs',
        description: 'Cluster, pod, and workload reference for larger orchestrated environments',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_kubernetes_2026-04.zim',
        size: '571K',
      },
    ],
  },
  {
    category: 'it-infrastructure',
    tier: {
      name: 'Comprehensive',
      slug: 'it-infrastructure-comprehensive',
      description: 'The broader operator shelf for infra-as-code, edge docs, and production reference. Includes Standard.',
      includesTier: 'it-infrastructure-standard',
    },
    resources: [
      {
        id: 'devdocs_en_terraform',
        version: '2026-04',
        title: 'Terraform Docs',
        description: 'Infrastructure-as-code reference for repeatable local and remote stack setup',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_terraform_2026-04.zim',
        size: '3.0M',
      },
      {
        id: 'devdocs_en_apache-http-server',
        version: '2026-04',
        title: 'Apache HTTP Server Docs',
        description: 'Web-serving, modules, and classic HTTP stack reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_apache-http-server_2026-04.zim',
        size: '1.3M',
      },
    ],
  },
  {
    category: 'security-privacy',
    tier: {
      name: 'Essential',
      slug: 'security-privacy-essential',
      description: 'Start with the practical defense and privacy shelf.',
      recommended: true,
    },
    resources: [
      {
        id: 'security.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Security Q&A',
        description: 'Practical security, privacy, defense, and threat-model discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/security.stackexchange.com_en_all_2026-02.zim',
        size: '420M',
      },
      {
        id: 'tor.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Tor Q&A',
        description: 'Tor, anonymity, routing, and privacy-minded troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/tor.stackexchange.com_en_all_2026-02.zim',
        size: '30M',
      },
    ],
  },
  {
    category: 'security-privacy',
    tier: {
      name: 'Standard',
      slug: 'security-privacy-standard',
      description: 'Add hardware and reverse-engineering depth once the core safety shelf is in place. Includes Essential.',
      includesTier: 'security-privacy-essential',
    },
    resources: [
      {
        id: 'reverseengineering.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Reverse Engineering Q&A',
        description: 'Binary analysis, malware-adjacent learning, and reverse-engineering workflow reference',
        url: 'https://download.kiwix.org/zim/stack_exchange/reverseengineering.stackexchange.com_en_all_2026-02.zim',
        size: '109M',
      },
      {
        id: 'hsm.stackexchange.com_en_all',
        version: '2026-02',
        title: 'History of Science & Math Q&A',
        description: 'Historical context around scientific ideas, math, and the way technical knowledge moved over time',
        url: 'https://download.kiwix.org/zim/stack_exchange/hsm.stackexchange.com_en_all_2026-02.zim',
        size: '49M',
      },
    ],
  },
  {
    category: 'security-privacy',
    tier: {
      name: 'Comprehensive',
      slug: 'security-privacy-comprehensive',
      description: 'The larger security shelf for edge, web, and platform protection context. Includes Standard.',
      includesTier: 'security-privacy-standard',
    },
    resources: [
      {
        id: 'cloudflare.com_en_learning-center',
        version: '2025-12',
        title: 'Cloudflare Learning Center',
        description: 'A broad edge, DNS, WAF and web-security reference from Cloudflare',
        url: 'https://download.kiwix.org/zim/zimit/cloudflare.com_en_learning-center_2025-12.zim',
        size: '182M',
      },
    ],
  },
  {
    category: 'games-pop-culture',
    tier: {
      name: 'Standard',
      slug: 'games-pop-culture-standard',
      description: 'Add more systems-and-mechanics shelves once the first culture lane is already in place. Includes Essential.',
      includesTier: 'games-pop-culture-essential',
    },
    resources: [
      {
        id: 'gamedev.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Game Development Q&A',
        description: 'Engines, gameplay systems, pipelines, and game-building troubleshooting',
        url: 'https://download.kiwix.org/zim/stack_exchange/gamedev.stackexchange.com_en_all_2026-02.zim',
        size: '508M',
      },
      {
        id: 'chess.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Chess Q&A',
        description: 'Openings, tactics, endgames, and position-heavy reference for board-brain installs',
        url: 'https://download.kiwix.org/zim/stack_exchange/chess.stackexchange.com_en_all_2026-02.zim',
        size: '77M',
      },
    ],
  },
  {
    category: 'dictionaries-primary-sources',
    tier: {
      name: 'Standard',
      slug: 'dictionaries-primary-sources-standard',
      description: 'Layer in the reader and book-world shelf once the base language lane is already in place. Includes Essential.',
      includesTier: 'dictionaries-primary-sources-essential',
    },
    resources: [
      {
        id: 'ebooks.stackexchange.com_en_all',
        version: '2026-02',
        title: 'Ebooks Q&A',
        description: 'Formats, readers, conversion, metadata, and practical ebook workflow discussion',
        url: 'https://download.kiwix.org/zim/stack_exchange/ebooks.stackexchange.com_en_all_2026-02.zim',
        size: '14M',
      },
    ],
  },
  {
    category: 'science-simulations',
    tier: {
      name: 'Comprehensive',
      slug: 'science-simulations-comprehensive',
      description: 'Pull in the big sky-and-imagery archive once the base science lane is already healthy. Includes Standard.',
      includesTier: 'science-simulations-standard',
    },
    resources: [
      {
        id: 'apod.nasa.gov_en_all',
        version: '2026-02',
        title: 'Astronomy Picture of the Day',
        description: 'NASA’s long-running image-and-explainer archive for missions, sky events, observatories, and space history',
        url: 'https://download.kiwix.org/zim/zimit/apod.nasa.gov_en_all_2026-02.zim',
        size: '8.5G',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Standard',
      slug: 'computing-standard',
      description: 'Broaden the coding shelf with fast-reference web docs and the practical tooling you actually reach for. Includes Essential.',
      includesTier: 'computing-essential',
    },
    resources: [
      {
        id: 'devhints.io_en_all',
        version: '2026-03',
        title: 'Devhints',
        description: 'Dense cheatsheets for frameworks, CLIs, languages, and everyday dev muscle-memory work',
        url: 'https://download.kiwix.org/zim/zimit/devhints.io_en_all_2026-03.zim',
        size: '3.8M',
      },
      {
        id: 'getbootstrap.com_en_all',
        version: '2025-12',
        title: 'Bootstrap Docs',
        description: 'Components, layout patterns and utility classes from the Bootstrap docs',
        url: 'https://download.kiwix.org/zim/zimit/getbootstrap.com_en_all_2025-12.zim',
        size: '159M',
      },
      {
        id: 'dart.dev_en_all',
        version: '2025-11',
        title: 'Dart Docs',
        description: 'The main Dart language shelf for syntax, tooling, packages, and language behavior',
        url: 'https://download.kiwix.org/zim/zimit/dart.dev_en_all_2025-11.zim',
        size: '45M',
      },
    ],
  },
  {
    category: 'computing',
    tier: {
      name: 'Comprehensive',
      slug: 'computing-comprehensive',
      description: 'A wider dev shelf for frontend styling, alt runtimes, and deeper build tooling. Includes Standard.',
      includesTier: 'computing-standard',
    },
    resources: [
      {
        id: 'lua.org_en_all',
        version: '2026-02',
        title: 'Lua.org',
        description: 'The main Lua language site packaged as an install-ready shelf for scripting and embedded work',
        url: 'https://download.kiwix.org/zim/zimit/lua.org_en_all_2026-02.zim',
        size: '371M',
      },
      {
        id: 'devdocs_en_css',
        version: '2026-04',
        title: 'CSS Docs',
        description: 'Selectors, layout, browser behavior, and styling reference for frontend work that stays sharp',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_css_2026-04.zim',
        size: '4.7M',
      },
      {
        id: 'devdocs_en_dart',
        version: '2026-04',
        title: 'Dart API Docs',
        description: 'API and package reference for deeper Dart and Flutter-adjacent language work',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_dart_2026-04.zim',
        size: '9.8M',
      },
      {
        id: 'devdocs_en_deno',
        version: '2026-02',
        title: 'Deno Docs',
        description: 'Runtime, tooling, permissions, and TypeScript-first server reference',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_deno_2026-02.zim',
        size: '2.6M',
      },
      {
        id: 'devdocs_en_bazel',
        version: '2026-04',
        title: 'Bazel Docs',
        description: 'Build-system reference for large polyglot repos, caching, and reproducible tooling',
        url: 'https://download.kiwix.org/zim/devdocs/devdocs_en_bazel_2026-04.zim',
        size: '432K',
      },
    ],
  },
  {
    category: 'security-privacy',
    tier: {
      name: 'Standard',
      slug: 'security-privacy-standard',
      description: 'Add compact anonymity and reverse-engineering depth once the core safety shelf is in place. Includes Essential.',
      includesTier: 'security-privacy-essential',
    },
    resources: [
      {
        id: 'incognitocat.me_en_all',
        version: '2025-09',
        title: 'Incognito Cat',
        description: 'A compact privacy-and-anonymity shelf for hardened browsing, opsec basics, and safer defaults',
        url: 'https://download.kiwix.org/zim/zimit/incognitocat.me_en_all_2025-09.zim',
        size: '8.9M',
      },
    ],
  },
]

for (const addition of tierAdds) {
  const category = upsertCategory(
    data,
    categoryDefinitions[addition.category] || data.categories.find((entry) => entry.slug === addition.category)
  )

  if (!category) continue

  const tier = upsertTier(category, { ...addition.tier, resources: [] })
  for (const resource of addition.resources) {
    upsertResource(tier, resource)
  }
}

const cleanupRemovals = [
  { category: 'maker-electronics', tier: 'maker-electronics-standard', ids: ['arduino.stackexchange.com_en_all'] },
  { category: 'maker-electronics', tier: 'maker-electronics-comprehensive', ids: ['mechanics.stackexchange.com_en_all'] },
  { category: 'agriculture', tier: 'agriculture-standard', ids: ['based.cooking_en_all'] },
  { category: 'homestead-sustainability', tier: 'homestead-sustainability-standard', ids: ['gardening.stackexchange.com_en_all'] },
  { category: 'homestead-sustainability', tier: 'homestead-sustainability-comprehensive', ids: ['crafts.stackexchange.com_en_all'] },
  { category: 'computing', tier: 'computing-comprehensive', ids: ['devdocs_en_react'] },
  { category: 'computing', tier: 'computing-standard', ids: ['coreyms_en_python-tutorials', 'docs.python.org_en', 'devdocs_en_docker'] },
  { category: 'computing', tier: 'computing-comprehensive', ids: ['devdocs_en_kubernetes'] },
  { category: 'machine-learning', tier: 'machine-learning-comprehensive', ids: ['devdocs_en_numpy', 'devdocs_en_pandas', 'devdocs_en_pytorch', 'devdocs_en_scikit-learn'] },
  { category: 'design-visual-media', tier: 'design-visual-media-comprehensive', ids: ['graphicdesign.stackexchange.com_en_all', 'photo.stackexchange.com_en_all'] },
  { category: 'it-infrastructure', tier: 'it-infrastructure-standard', ids: ['cloudflare.com_en_learning-center', 'devdocs_en_apache-http-server'] },
  { category: 'it-infrastructure', tier: 'it-infrastructure-essential', ids: ['archlinux_en_all_maxi', 'alpinelinux_en_all_maxi'] },
  { category: 'it-infrastructure', tier: 'it-infrastructure-comprehensive', ids: ['security.stackexchange.com_en_all'] },
  // Moved to math-logic-essential; Standard still includes it through includesTier.
  { category: 'math-logic', tier: 'math-logic-standard', ids: ['matheducators.stackexchange.com_en_all'] },
]

for (const cleanup of cleanupRemovals) {
  const category = data.categories.find((entry) => entry.slug === cleanup.category)
  const tier = category?.tiers.find((entry) => entry.slug === cleanup.tier)
  if (!tier) continue
  tier.resources = tier.resources.filter((resource) => !cleanup.ids.includes(resource.id))
}

const order = [
  'medicine',
  'survival',
  'education',
  'science-simulations',
  'kids-family',
  'open-courses',
  'math-logic',
  'law-history-society',
  'language-writing',
  'diy',
  'maker-electronics',
  'agriculture',
  'homestead-sustainability',
  'finance-crypto',
  'computing',
  'machine-learning',
  'platforms-systems',
  'security-privacy',
  'music-audio',
  'design-visual-media',
  'it-infrastructure',
  'travel-field-guides',
  'travel-mobility-outdoors',
  'games-pop-culture',
  'dictionaries-primary-sources',
]

const orderMap = new Map(order.map((slug, index) => [slug, index]))
data.categories.sort((a, b) => (orderMap.get(a.slug) ?? 999) - (orderMap.get(b.slug) ?? 999))

for (const category of data.categories) {
  const tierOrder = new Map(['essential', 'standard', 'comprehensive'].map((label, index) => [label, index]))
  category.tiers.sort((a, b) => {
    const aKey = a.slug.split('-').pop()
    const bKey = b.slug.split('-').pop()
    return (tierOrder.get(aKey) ?? 999) - (tierOrder.get(bKey) ?? 999)
  })
}

// The manifest's revision is the day it was written, as refresh-kiwix-versions.mjs stamps it.
data.spec_version = new Date().toISOString().slice(0, 10)
await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(`Updated ${file.pathname}`)
