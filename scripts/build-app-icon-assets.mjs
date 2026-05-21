#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const catalogPath = path.join(repoRoot, 'app-store-catalog.json')
const outputDir = path.join(repoRoot, 'assets', 'app-icons')

const palettes = {
  blue: {
    from: '#08111D',
    to: '#153C70',
    glow: '#74F4FF',
    edge: '#CDE6FF',
    ink: '#F5FAFF',
    band: '#86D0FF',
  },
  cyan: {
    from: '#07151A',
    to: '#0F4957',
    glow: '#7CF9F3',
    edge: '#D0FFFC',
    ink: '#F5FFFF',
    band: '#7CF9F3',
  },
  green: {
    from: '#08150E',
    to: '#164C2F',
    glow: '#73FFA8',
    edge: '#D9FFE8',
    ink: '#F7FFFA',
    band: '#73FFA8',
  },
  gold: {
    from: '#191106',
    to: '#5F4212',
    glow: '#FFCC73',
    edge: '#FFF0D0',
    ink: '#FFF9F0',
    band: '#FFCC73',
  },
  bronze: {
    from: '#160F0D',
    to: '#5A3020',
    glow: '#F3A574',
    edge: '#FFE0D1',
    ink: '#FFF8F4',
    band: '#F3A574',
  },
  violet: {
    from: '#120A1D',
    to: '#3F2575',
    glow: '#BC9CFF',
    edge: '#EEE5FF',
    ink: '#FAF7FF',
    band: '#C9A8FF',
  },
  magenta: {
    from: '#180813',
    to: '#6F1858',
    glow: '#FF86E1',
    edge: '#FFE2F7',
    ink: '#FFF8FD',
    band: '#FF86E1',
  },
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function paletteFor(accent) {
  return palettes[accent] || palettes.blue
}

function compactLabel(value, fallback = 'RoachNet') {
  const raw = String(value || fallback)
    .replace(/\s*&\s*/g, ' ')
    .replace(/[^a-z0-9 +.-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return fallback
  if (raw.length <= 12) return raw

  const acronym = raw
    .split(/[ +.-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (acronym.length >= 2 && acronym.length <= 8) return acronym
  return raw.slice(0, 10).trim().toUpperCase()
}

function hashString(value) {
  return [...String(value || '')].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
}

function coverTitleLines(value) {
  const words = String(value || 'RoachNet Pack')
    .replace(/\b(RoachNet|Offline|Library|Pack|Shelf)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  if (!words.length) return ['RoachNet', 'Pack']

  const lines = ['', '']
  for (const word of words) {
    const target = lines[0].length <= 13 ? 0 : 1
    const next = [lines[target], word].filter(Boolean).join(' ')
    if (next.length <= 16 || !lines[target]) {
      lines[target] = next
    } else if (!lines[1]) {
      lines[1] = word
    }
  }

  return lines.map((line) => compactLabel(line, 'PACK')).filter(Boolean).slice(0, 2)
}

function familyLabel(family, section) {
  const labels = {
    agriculture: 'FIELD DATA',
    audio: 'AUDIO SHELF',
    civic: 'PUBLIC RECORD',
    courses: 'COURSE DROP',
    culture: 'MEDIA VAULT',
    design: 'VISUAL KIT',
    development: 'DEV TOOL',
    education: 'REFERENCE',
    finance: 'LEDGER',
    homestead: 'HOMESTEAD',
    infrastructure: 'OPS PACK',
    kids: 'FAMILY',
    language: 'LANGUAGE',
    library: 'LIBRARY',
    maker: 'WORKSHOP',
    maps: 'MAP CACHE',
    math: 'PROBLEM SET',
    medicine: 'MED SHELF',
    ml: 'MODEL LANE',
    models: 'MODEL PACK',
    repair: 'FIX KIT',
    science: 'SIM SHELF',
    security: 'SECURITY',
    survival: 'FIELD KIT',
    systems: 'SYSTEMS',
    travel: 'FIELD MAP',
    voice: 'VOICE CORE',
    wikipedia: 'WIKI DUMP',
  }

  return labels[family] || compactLabel(section, 'ROACHNET').toUpperCase()
}

function materialMarkup(family, palette) {
  const dot = `fill="${palette.edge}" fill-opacity="0.24"`
  const glowStroke = `stroke="${palette.glow}" stroke-opacity="0.42" stroke-width="3" stroke-linecap="round"`
  const softStroke = `stroke="${palette.edge}" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round"`

  if (['voice', 'audio'].includes(family)) {
    return `
      <g opacity="0.82">
        <rect x="84" y="270" width="18" height="62" rx="9" fill="${palette.glow}" fill-opacity="0.42"/>
        <rect x="112" y="240" width="18" height="112" rx="9" fill="${palette.edge}" fill-opacity="0.2"/>
        <rect x="140" y="286" width="18" height="42" rx="9" fill="${palette.glow}" fill-opacity="0.3"/>
        <rect x="168" y="222" width="18" height="140" rx="9" fill="${palette.band}" fill-opacity="0.28"/>
        <rect x="196" y="258" width="18" height="82" rx="9" fill="${palette.glow}" fill-opacity="0.22"/>
        <path d="M250 294C292 238 334 236 380 292" ${glowStroke}/>
        <path d="M250 324C302 276 344 270 404 310" ${softStroke}/>
      </g>
    `
  }

  if (['maps', 'travel'].includes(family)) {
    return `
      <g opacity="0.76">
        <path d="M42 318C104 254 170 236 242 262C316 288 374 262 456 188" fill="none" ${glowStroke}/>
        <path d="M48 356C120 298 188 286 250 306C318 328 390 294 474 232" fill="none" ${softStroke}/>
        <path d="M72 390C134 350 214 336 300 354C358 366 408 354 462 326" fill="none" ${softStroke}/>
        <circle cx="330" cy="242" r="42" fill="${palette.glow}" fill-opacity="0.13"/>
        <circle cx="330" cy="242" r="12" ${dot}/>
      </g>
    `
  }

  if (['models', 'ml', 'development', 'systems', 'infrastructure', 'security'].includes(family)) {
    return `
      <g opacity="0.78">
        <rect x="278" y="152" width="118" height="118" rx="30" fill="${palette.glow}" fill-opacity="0.09" stroke="${palette.edge}" stroke-opacity="0.2" stroke-width="2"/>
        <circle cx="308" cy="184" r="7" ${dot}/>
        <circle cx="366" cy="184" r="7" ${dot}/>
        <circle cx="336" cy="238" r="7" ${dot}/>
        <path d="M308 184L336 238L366 184M308 184H366" ${glowStroke}/>
        <path d="M104 336H222M104 362H186M104 388H258" ${softStroke}/>
      </g>
    `
  }

  if (['library', 'education', 'wikipedia', 'courses', 'language', 'civic', 'math'].includes(family)) {
    return `
      <g opacity="0.76">
        <rect x="294" y="132" width="36" height="190" rx="14" fill="${palette.glow}" fill-opacity="0.16"/>
        <rect x="336" y="154" width="36" height="168" rx="14" fill="${palette.edge}" fill-opacity="0.12"/>
        <rect x="378" y="178" width="36" height="144" rx="14" fill="${palette.band}" fill-opacity="0.14"/>
        <path d="M92 344H234M92 370H196M92 396H254" ${softStroke}/>
      </g>
    `
  }

  if (['medicine', 'survival', 'agriculture', 'homestead', 'repair'].includes(family)) {
    return `
      <g opacity="0.76">
        <path d="M318 142C378 170 412 220 404 282C344 278 300 238 294 178C304 162 312 150 318 142Z" fill="${palette.glow}" fill-opacity="0.15"/>
        <path d="M292 322C232 298 194 248 198 186C258 186 308 222 322 282C314 300 304 314 292 322Z" fill="${palette.edge}" fill-opacity="0.1"/>
        <path d="M94 348H238M94 374H204M94 400H260" ${softStroke}/>
      </g>
    `
  }

  return `
    <g opacity="0.74">
      <circle cx="336" cy="224" r="72" fill="${palette.glow}" fill-opacity="0.09"/>
      <circle cx="336" cy="224" r="42" fill="${palette.edge}" fill-opacity="0.07"/>
      <path d="M96 336H248M96 364H198M96 392H282" ${softStroke}/>
    </g>
  `
}

function glyphMarkup(family) {
  switch (family) {
    case 'maps':
      return `
        <path d="M154 176L224 146L294 176L362 148V330L294 360L224 330L154 360V176Z"/>
        <path d="M224 146V330M294 176V360"/>
        <path d="M256 218C282 218 302 238 302 264C302 296 272 322 256 334C240 322 210 296 210 264C210 238 230 218 256 218Z"/>
        <circle cx="256" cy="264" r="14"/>
      `
    case 'medicine':
      return `
        <rect x="188" y="168" width="136" height="154" rx="36"/>
        <path d="M256 198V292M210 245H302"/>
        <path d="M214 168V148H298V168"/>
      `
    case 'survival':
    case 'security':
      return `
        <path d="M256 142L348 178V246C348 306 312 350 256 382C200 350 164 306 164 246V178L256 142Z"/>
        <path d="M216 252L246 282L304 218"/>
      `
    case 'education':
    case 'library':
      return `
        <path d="M160 174C160 156 174 142 192 142H250C274 142 292 154 302 174V350C292 336 274 328 250 328H192C174 328 160 342 160 360V174Z"/>
        <path d="M352 174C352 156 338 142 320 142H262C238 142 220 154 210 174V350C220 336 238 328 262 328H320C338 328 352 342 352 360V174Z"/>
        <path d="M256 150V342"/>
      `
    case 'science':
      return `
        <circle cx="256" cy="252" r="20"/>
        <ellipse cx="256" cy="252" rx="118" ry="44"/>
        <ellipse cx="256" cy="252" rx="118" ry="44" transform="rotate(60 256 252)"/>
        <ellipse cx="256" cy="252" rx="118" ry="44" transform="rotate(120 256 252)"/>
      `
    case 'kids':
      return `
        <path d="M256 142L286 206H356L300 248L322 318L256 276L190 318L212 248L156 206H226L256 142Z"/>
        <path d="M224 246H225M288 246H289M224 286C242 302 270 302 288 286"/>
      `
    case 'courses':
      return `
        <rect x="146" y="156" width="220" height="150" rx="34"/>
        <path d="M232 198L304 232L232 266V198Z"/>
        <path d="M196 350H316M256 306V350"/>
      `
    case 'math':
      return `
        <path d="M172 176H340M186 178L258 252L186 326H340"/>
        <circle cx="340" cy="176" r="10"/>
        <circle cx="340" cy="326" r="10"/>
      `
    case 'civic':
      return `
        <path d="M156 200L256 154L356 200"/>
        <path d="M184 218V326M232 218V326M280 218V326M328 218V326"/>
        <path d="M148 344H364"/>
      `
    case 'language':
    case 'culture':
      return `
        <path d="M156 174H356C374 174 388 188 388 206V286C388 304 374 318 356 318H278L222 362V318H156C138 318 124 304 124 286V206C124 188 138 174 156 174Z"/>
        <path d="M184 226H328M184 268H292"/>
      `
    case 'repair':
      return `
        <path d="M212 158C230 176 234 202 222 224L300 302C322 290 348 294 366 312C386 332 386 364 366 384C346 404 314 404 294 384C276 366 272 340 284 318L206 240C184 252 158 248 140 230C120 210 120 178 140 158L180 198L220 158H212Z"/>
      `
    case 'maker':
    case 'infrastructure':
    case 'systems':
      return `
        <rect x="172" y="168" width="168" height="168" rx="34"/>
        <rect x="218" y="214" width="76" height="76" rx="18"/>
        <path d="M210 126V168M256 126V168M302 126V168M210 336V378M256 336V378M302 336V378M130 210H172M130 256H172M130 302H172M340 210H382M340 256H382M340 302H382"/>
      `
    case 'agriculture':
    case 'homestead':
      return `
        <path d="M162 244L256 160L350 244V356H288V296H224V356H162V244Z"/>
        <path d="M308 160C344 166 362 188 362 216C336 216 314 202 308 160Z"/>
        <path d="M204 252C238 246 260 224 268 190"/>
      `
    case 'finance':
      return `
        <path d="M158 326H356"/>
        <path d="M188 300L238 246L280 276L340 190"/>
        <circle cx="214" cy="206" r="42"/>
        <circle cx="304" cy="304" r="32"/>
      `
    case 'development':
      return `
        <rect x="146" y="154" width="220" height="190" rx="34"/>
        <path d="M218 214L178 254L218 294M294 214L334 254L294 294"/>
        <path d="M270 200L242 308"/>
      `
    case 'ml':
    case 'models':
      return `
        <path d="M188 220C188 186 216 158 250 158H262C296 158 324 186 324 220V286C324 320 296 348 262 348H250C216 348 188 320 188 286V220Z"/>
        <circle cx="226" cy="242" r="13"/>
        <circle cx="286" cy="242" r="13"/>
        <path d="M226 298C242 312 270 312 286 298"/>
        <path d="M214 158L194 124M298 158L318 124"/>
      `
    case 'audio':
      return `
        <path d="M154 256C178 256 178 204 202 204C226 204 226 326 250 326C274 326 274 174 298 174C322 174 322 304 346 304C370 304 370 228 388 228"/>
        <path d="M154 356H358"/>
      `
    case 'design':
      return `
        <path d="M190 318L312 196"/>
        <path d="M300 166L346 212L224 334L166 350L182 292L300 166Z"/>
        <circle cx="204" cy="210" r="42"/>
      `
    case 'travel':
      return `
        <path d="M256 142C312 142 358 188 358 244C358 314 284 372 256 390C228 372 154 314 154 244C154 188 200 142 256 142Z"/>
        <circle cx="256" cy="244" r="36"/>
      `
    case 'wikipedia':
      return `
        <circle cx="256" cy="252" r="112"/>
        <path d="M184 196L220 312L256 228L292 312L328 196"/>
      `
    case 'voice':
      return `
        <rect x="198" y="150" width="96" height="178" rx="48"/>
        <path d="M166 240C190 240 192 204 216 204"/>
        <path d="M294 204C322 204 344 228 344 258C344 288 322 312 294 312"/>
        <path d="M318 174C360 204 384 250 384 302"/>
        <path d="M246 328V372M206 372H286"/>
        <path d="M232 206V272M260 206V272"/>
      `
    default:
      return `
        <path d="M160 256C160 202 202 160 256 160C310 160 352 202 352 256C352 310 310 352 256 352C202 352 160 310 160 256Z"/>
        <path d="M206 256H306M256 206V306"/>
      `
  }
}

function polishedIconArtwork(item, family, palette, mono) {
  const titleLines = coverTitleLines(item.title || item.category || 'RoachNet Pack')
  const sectionLabel = xml(familyLabel(family, item.section || item.category || 'ROACHNET'))
  const titleOne = xml(titleLines[0] || 'ROACHNET')
  const titleTwo = xml(titleLines[1] || 'PACK')
  const monoText = xml(mono)
  const seed = Math.abs(hashString(`${item.id}:${item.title}:${item.section}`))
  const flareX = 118 + (seed % 190)
  const flareY = 128 + ((seed >> 3) % 110)
  const cutA = 86 + ((seed >> 5) % 80)
  const cutB = 286 + ((seed >> 7) % 84)
  const titleSize = titleOne.length > 11 ? 42 : 50
  const titleTwoSize = titleTwo.length > 11 ? 34 : 42
  const descriptor = xml(compactLabel(item.subtitle || item.status || item.category || item.section, 'LOCAL PACK'))

  return `
    <g opacity="0.94">
      <path d="M-34 ${cutA + 8}C72 ${cutA - 48} 174 ${cutA - 18} 288 ${cutA - 58}C382 ${cutA - 92} 462 ${cutA - 58} 550 ${cutA - 98}V-30H-34V${cutA + 8}Z" fill="${palette.glow}" fill-opacity="0.13"/>
      <path d="M-28 ${cutB + 92}C86 ${cutB + 28} 186 ${cutB + 26} 300 ${cutB + 54}C398 ${cutB + 78} 462 ${cutB + 26} 540 ${cutB - 18}V552H-28V${cutB + 92}Z" fill="#000000" fill-opacity="0.27"/>
      <path d="M38 ${cutA + 38}C128 ${cutA - 4} 220 ${cutA + 22} 318 ${cutA - 26}C382 ${cutA - 58} 430 ${cutA - 36} 482 ${cutA - 14}" fill="none" stroke="${palette.edge}" stroke-opacity="0.13" stroke-width="24" stroke-linecap="round"/>
      <path d="M40 ${cutB + 56}C134 ${cutB + 10} 222 ${cutB + 16} 304 ${cutB + 42}C380 ${cutB + 66} 428 ${cutB + 34} 478 ${cutB + 2}" fill="none" stroke="${palette.glow}" stroke-opacity="0.16" stroke-width="15" stroke-linecap="round"/>
      <circle cx="${flareX}" cy="${flareY}" r="116" fill="${palette.glow}" fill-opacity="0.08" filter="url(#softBlur)"/>
      <circle cx="${flareX + 118}" cy="${flareY + 72}" r="88" fill="${palette.band}" fill-opacity="0.08" filter="url(#softBlur)"/>
      <path d="M84 114C168 88 244 116 316 88C366 68 410 76 458 110" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="18" stroke-linecap="round"/>
    </g>
    ${materialMarkup(family, palette)}
    <g filter="url(#titleLift)">
      <text x="92" y="184" fill="${palette.ink}" font-family="Inter, SF Pro Display, Arial, sans-serif" font-size="${titleSize}" font-weight="900" letter-spacing="-0.06em">${titleOne}</text>
      <text x="92" y="${titleTwo ? 226 : 218}" fill="${palette.ink}" fill-opacity="0.92" font-family="Inter, SF Pro Display, Arial, sans-serif" font-size="${titleTwoSize}" font-weight="900" letter-spacing="-0.055em">${titleTwo}</text>
      <path d="M94 250H${290 + (seed % 82)}" stroke="${palette.glow}" stroke-width="4" stroke-linecap="round" opacity="0.78"/>
      <path d="M94 265H${178 + (seed % 86)}" stroke="${palette.edge}" stroke-width="2" stroke-linecap="round" opacity="0.28"/>
    </g>
    <g>
      <rect x="82" y="346" width="236" height="54" rx="27" fill="#020406" fill-opacity="0.76" stroke="${palette.edge}" stroke-opacity="0.14" stroke-width="2"/>
      <text x="104" y="381" fill="${palette.ink}" font-family="JetBrains Mono, SF Mono, monospace" font-size="24" font-weight="900" letter-spacing="0.1em">${monoText}</text>
      <text x="182" y="381" fill="${palette.band}" font-family="Inter, SF Pro Display, Arial, sans-serif" font-size="13" font-weight="800" letter-spacing="0.12em">${descriptor}</text>
      <rect x="326" y="346" width="104" height="54" rx="27" fill="#020406" fill-opacity="0.58" stroke="${palette.edge}" stroke-opacity="0.12" stroke-width="2"/>
      <text x="378" y="378" text-anchor="middle" fill="${palette.band}" font-family="JetBrains Mono, SF Mono, monospace" font-size="12" font-weight="800" letter-spacing="0.12em">${sectionLabel}</text>
    </g>
  `
}

function familyMarkup(family, palette) {
  const stroke = palette.glow
  const edge = palette.edge
  const ink = palette.ink

  switch (family) {
    case 'maps':
      return `
        <rect x="128" y="134" width="256" height="212" rx="34" fill="rgba(255,255,255,0.05)" stroke="${edge}" stroke-width="10"/>
        <path d="M172 170H340" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M172 240H340" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M172 310H340" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M192 154V330" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M256 154V330" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M320 154V330" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="256" cy="240" r="28" fill="#09131C" stroke="${edge}" stroke-width="10"/>
      `
    case 'medicine':
      return `
        <circle cx="256" cy="244" r="88" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M256 178V310" stroke="${stroke}" stroke-width="22" stroke-linecap="round"/>
        <path d="M190 244H322" stroke="${stroke}" stroke-width="22" stroke-linecap="round"/>
      `
    case 'survival':
      return `
        <path d="M256 142L340 174V242C340 300 308 350 256 384C204 350 172 300 172 242V174L256 142Z" fill="rgba(255,255,255,0.05)" stroke="${edge}" stroke-width="10"/>
        <path d="M222 242L248 270L296 214" stroke="${stroke}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      `
    case 'education':
      return `
        <path d="M148 188C148 170 162 156 180 156H252C274 156 292 170 300 188V336C292 320 274 308 252 308H180C162 308 148 322 148 340V188Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M364 188C364 170 350 156 332 156H260C238 156 220 170 212 188V336C220 320 238 308 260 308H332C350 308 364 322 364 340V188Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M256 164V332" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'science':
      return `
        <circle cx="256" cy="244" r="24" fill="${ink}" opacity="0.92"/>
        <ellipse cx="256" cy="244" rx="106" ry="42" stroke="${stroke}" stroke-width="10"/>
        <ellipse cx="256" cy="244" rx="106" ry="42" transform="rotate(60 256 244)" stroke="${edge}" stroke-width="10"/>
        <ellipse cx="256" cy="244" rx="106" ry="42" transform="rotate(120 256 244)" stroke="${stroke}" stroke-width="10"/>
      `
    case 'kids':
      return `
        <path d="M256 148L282 206H346L294 242L314 304L256 268L198 304L218 242L166 206H230L256 148Z" fill="rgba(255,255,255,0.06)" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="222" cy="244" r="10" fill="${stroke}"/>
        <circle cx="290" cy="244" r="10" fill="${stroke}"/>
        <path d="M220 284C236 300 276 300 292 284" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'courses':
      return `
        <rect x="148" y="154" width="216" height="152" rx="24" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M202 344H310" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M256 306V344" stroke="${edge}" stroke-width="12" stroke-linecap="round"/>
        <path d="M230 198L298 230L230 262V198Z" fill="${stroke}"/>
      `
    case 'math':
      return `
        <path d="M180 170H332" stroke="${edge}" stroke-width="12" stroke-linecap="round"/>
        <path d="M188 176L256 244L188 312H332" stroke="${stroke}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="328" cy="176" r="10" fill="${stroke}"/>
        <circle cx="328" cy="312" r="10" fill="${stroke}"/>
      `
    case 'civic':
      return `
        <path d="M164 192L256 152L348 192" fill="rgba(255,255,255,0.03)" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <path d="M182 206V320" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M230 206V320" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M282 206V320" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M330 206V320" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M152 332H360" stroke="${edge}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'language':
      return `
        <path d="M164 182C164 162 180 146 200 146H312C332 146 348 162 348 182V264C348 284 332 300 312 300H242L202 340V300H200C180 300 164 284 164 264V182Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M210 198H302" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M210 238H278" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'repair':
      return `
        <path d="M212 168C224 182 226 200 218 216L296 294C312 286 330 288 344 300C362 316 366 344 352 362C338 380 308 382 290 366C278 354 274 338 278 322L200 244C184 252 166 250 152 238C134 222 130 194 144 176C158 158 188 156 206 172L176 202L208 234L238 204L212 168Z" fill="rgba(255,255,255,0.05)" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
      `
    case 'maker':
      return `
        <rect x="170" y="160" width="172" height="172" rx="28" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M214 126V160M256 126V160M298 126V160M214 332V366M256 332V366M298 332V366M136 204H170M136 246H170M136 288H170M342 204H376M342 246H376M342 288H376" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <rect x="218" y="208" width="76" height="76" rx="18" fill="#09131C" stroke="${stroke}" stroke-width="10"/>
      `
    case 'agriculture':
      return `
        <path d="M256 148C310 176 340 222 340 278C340 332 302 370 256 388C210 370 172 332 172 278C172 222 202 176 256 148Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M256 182V334" stroke="${stroke}" stroke-width="14" stroke-linecap="round"/>
        <path d="M256 232C218 228 198 206 190 186" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M256 270C294 266 314 244 322 224" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'finance':
      return `
        <circle cx="210" cy="250" r="48" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <circle cx="302" cy="214" r="34" fill="rgba(255,255,255,0.03)" stroke="${stroke}" stroke-width="10"/>
        <path d="M188 326H324" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
        <path d="M210 232V268M196 250H224" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'development':
      return `
        <rect x="146" y="150" width="220" height="184" rx="28" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M214 210L180 244L214 278" stroke="${stroke}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M298 210L332 244L298 278" stroke="${stroke}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M270 194L242 296" stroke="${edge}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'ml':
      return `
        <circle cx="188" cy="198" r="14" fill="${stroke}"/>
        <circle cx="324" cy="190" r="14" fill="${edge}"/>
        <circle cx="184" cy="304" r="14" fill="${edge}"/>
        <circle cx="316" cy="304" r="14" fill="${stroke}"/>
        <circle cx="256" cy="248" r="20" fill="${ink}" opacity="0.92"/>
        <path d="M202 208L238 234M274 236L310 204M202 294L238 262M274 260L302 292M256 228V208M256 268V288" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>
      `
    case 'systems':
      return `
        <rect x="136" y="160" width="240" height="152" rx="24" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M170 206H342M170 244H342M170 282H280" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M202 352H310" stroke="${edge}" stroke-width="14" stroke-linecap="round"/>
      `
    case 'security':
      return `
        <path d="M256 150L340 182V242C340 306 304 356 256 386C208 356 172 306 172 242V182L256 150Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <rect x="214" y="228" width="84" height="72" rx="18" fill="#09131C" stroke="${stroke}" stroke-width="10"/>
        <path d="M230 228V212C230 197 242 184 256 184C270 184 282 197 282 212V228" stroke="${edge}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="256" cy="262" r="10" fill="${stroke}"/>
        <path d="M256 272V292" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>
      `
    case 'audio':
      return `
        <path d="M160 246C178 246 184 204 202 204C220 204 226 290 244 290C262 290 268 176 286 176C304 176 310 314 328 314C346 314 352 230 352 230" stroke="${stroke}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="144" y="164" width="224" height="164" rx="30" fill="none" stroke="${edge}" stroke-width="10"/>
      `
    case 'design':
      return `
        <circle cx="198" cy="206" r="48" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <rect x="246" y="170" width="96" height="96" rx="24" fill="rgba(255,255,255,0.04)" stroke="${stroke}" stroke-width="10"/>
        <path d="M212 320L296 320L338 244" stroke="${stroke}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      `
    case 'infrastructure':
      return `
        <rect x="164" y="154" width="184" height="62" rx="18" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <rect x="164" y="228" width="184" height="62" rx="18" fill="rgba(255,255,255,0.04)" stroke="${stroke}" stroke-width="10"/>
        <rect x="164" y="302" width="184" height="46" rx="18" fill="rgba(255,255,255,0.03)" stroke="${edge}" stroke-width="10"/>
        <circle cx="198" cy="185" r="8" fill="${stroke}"/>
        <circle cx="198" cy="259" r="8" fill="${edge}"/>
        <circle cx="198" cy="325" r="8" fill="${stroke}"/>
      `
    case 'travel':
      return `
        <path d="M256 150C308 150 350 192 350 244C350 310 282 368 256 386C230 368 162 310 162 244C162 192 204 150 256 150Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <circle cx="256" cy="244" r="34" fill="#09131C" stroke="${stroke}" stroke-width="10"/>
      `
    case 'culture':
      return `
        <path d="M174 184H338C354 184 366 196 366 212V250C366 266 354 278 338 278H270L234 314V278H174C158 278 146 266 146 250V212C146 196 158 184 174 184Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M194 228H316" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M194 248H286" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
      `
    case 'homestead':
      return `
        <path d="M168 224L256 154L344 224V348H280V286H232V348H168V224Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <path d="M314 170C330 170 344 184 344 200C344 222 322 236 304 250C286 236 264 222 264 200C264 184 278 170 294 170C302 170 309 174 314 180C319 174 326 170 334 170Z" fill="${stroke}"/>
      `
    case 'library':
      return `
        <rect x="166" y="154" width="56" height="188" rx="18" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <rect x="228" y="132" width="56" height="210" rx="18" fill="rgba(255,255,255,0.04)" stroke="${stroke}" stroke-width="10"/>
        <rect x="290" y="170" width="56" height="172" rx="18" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
      `
    case 'wikipedia':
      return `
        <circle cx="256" cy="240" r="102" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M194 186L222 294L256 214L290 294L318 186" stroke="${stroke}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      `
    case 'models':
      return `
        <path d="M188 214C188 182 214 156 246 156H266C298 156 324 182 324 214V286C324 318 298 344 266 344H246C214 344 188 318 188 286V214Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <circle cx="228" cy="236" r="14" fill="${stroke}"/>
        <circle cx="284" cy="236" r="14" fill="${stroke}"/>
        <path d="M226 294C240 310 272 310 286 294" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
        <path d="M214 156L196 126M298 156L316 126" stroke="${edge}" stroke-width="10" stroke-linecap="round"/>
      `
    case 'voice':
      return `
        <path d="M164 244C190 244 196 188 222 188C248 188 252 310 278 310C304 310 312 214 338 214" stroke="${stroke}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M214 154H252C270 154 284 168 284 186V326C284 344 270 358 252 358H214C196 358 182 344 182 326V186C182 168 196 154 214 154Z" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M320 180C348 204 364 244 364 282C364 320 348 356 320 380" stroke="${edge}" stroke-width="10" stroke-linecap="round"/>
        <path d="M308 224C320 238 326 258 326 278C326 298 320 316 308 330" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>
        <circle cx="233" cy="214" r="10" fill="${stroke}"/>
        <circle cx="233" cy="298" r="10" fill="${stroke}"/>
      `
    default:
      return `
        <circle cx="256" cy="240" r="92" fill="rgba(255,255,255,0.04)" stroke="${edge}" stroke-width="10"/>
        <path d="M198 240H314" stroke="${stroke}" stroke-width="16" stroke-linecap="round"/>
      `
  }
}

function buildIconSvg(item) {
  const palette = paletteFor(item.accent)
  const family = item.iconFamily || 'general'
  const band = xml(compactLabel(item.iconBand || item.category || item.section, 'ROACHNET'))
  const monoRaw = compactLabel(item.iconMonogram || 'RN', 'RN').slice(0, 4)
  const mono = xml(monoRaw)
  const title = xml(item.title || 'RoachNet')
  const artwork = polishedIconArtwork(item, family, palette, monoRaw).trim()

  return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} icon">
  <defs>
    <clipPath id="tileClip">
      <rect x="0" y="0" width="512" height="512" rx="118"/>
    </clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020406"/>
      <stop offset="0.48" stop-color="${palette.from}"/>
      <stop offset="1" stop-color="${palette.to}"/>
    </linearGradient>
    <linearGradient id="line" x1="128" y1="132" x2="394" y2="386" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.edge}"/>
      <stop offset="0.46" stop-color="${palette.glow}"/>
      <stop offset="1" stop-color="${palette.band}"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.62"/>
      <stop offset="0.34" stop-color="${palette.glow}" stop-opacity="0.66"/>
      <stop offset="0.68" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${palette.band}" stop-opacity="0.5"/>
    </linearGradient>
    <linearGradient id="badge" x1="326" y1="368" x2="434" y2="430" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.from}"/>
      <stop offset="1" stop-color="#05070B"/>
    </linearGradient>
    <linearGradient id="coverGlass" x1="84" y1="106" x2="428" y2="406" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="0.46" stop-color="${palette.glow}" stop-opacity="0.025"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 152) rotate(52) scale(282 282)">
      <stop stop-color="${palette.glow}" stop-opacity="0.36"/>
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M0 17H18M17 0V18" stroke="${palette.glow}" stroke-opacity="0.08" stroke-width="1"/>
      <circle cx="4" cy="5" r="1" fill="${palette.edge}" fill-opacity="0.14"/>
      <circle cx="13" cy="12" r="1" fill="${palette.band}" fill-opacity="0.12"/>
    </pattern>
    <filter id="glyphGlow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${palette.glow}" flood-opacity="0.42"/>
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.36"/>
    </filter>
    <filter id="softBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="titleLift" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g clip-path="url(#tileClip)">
    <rect width="512" height="512" fill="url(#bg)"/>
    <rect width="512" height="512" fill="url(#glow)"/>
    <rect width="512" height="512" fill="url(#grain)" opacity="0.55"/>
    <path d="M-20 368C86 312 152 300 248 322C344 344 424 320 532 244V532H-20V368Z" fill="#000000" opacity="0.34"/>
    <path d="M52 100C140 48 252 46 360 82C432 106 484 150 508 192" stroke="${palette.edge}" stroke-width="32" stroke-linecap="round" opacity="0.06"/>
    <path d="M60 426C152 364 232 346 316 370C378 388 426 380 486 342" stroke="${palette.glow}" stroke-width="16" stroke-linecap="round" opacity="0.11"/>
    ${artwork}
    <rect x="58" y="62" width="188" height="44" rx="22" fill="#020406" fill-opacity="0.72" stroke="${palette.edge}" stroke-opacity="0.16" stroke-width="2"/>
    <text x="82" y="91" fill="${palette.band}" font-family="Inter, SF Pro Display, Arial, sans-serif" font-size="17" font-weight="800" letter-spacing="0.16em">${band}</text>
    <rect x="334" y="386" width="84" height="42" rx="21" fill="url(#badge)" fill-opacity="0.92" stroke="${palette.edge}" stroke-opacity="0.18" stroke-width="2"/>
    <path d="M354 407H398" stroke="${palette.glow}" stroke-opacity="0.72" stroke-width="3" stroke-linecap="round"/>
    <circle cx="354" cy="407" r="5" fill="${palette.edge}" opacity="0.8"/>
    <circle cx="398" cy="407" r="5" fill="${palette.band}" opacity="0.8"/>
  </g>
  <rect x="3" y="3" width="506" height="506" rx="116" stroke="url(#rim)" stroke-opacity="0.5" stroke-width="6"/>
  <rect x="19" y="19" width="474" height="474" rx="102" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2"/>
</svg>`
}

function cleanSvg(svg) {
  return `${svg.replace(/[ \t]+$/gm, '').trim()}\n`
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const items = Array.isArray(catalog.items) ? catalog.items : []

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })

  for (const item of items) {
    const target = path.join(outputDir, `${item.id}.svg`)
    await writeFile(target, cleanSvg(buildIconSvg(item)), 'utf8')
  }

  console.log(`Generated ${items.length} SVG app icons in ${path.relative(repoRoot, outputDir)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
