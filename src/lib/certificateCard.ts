import type { Stats } from '@/lib/types'
import type { ConsistencyTier } from '@/lib/certificates'
import { formatDateRange, isValidISODate } from '@/lib/dates'
import logoDarkUrl from '../../assets/logodark.png'
import candleTier3Url from '../assets/images/lux_candle_3m_slate_v3_1794649628509.jpg'
import candleTier6Url from '../assets/images/lux_candle_6m_emerald_v3_1794649629382.jpg'
import candleTier9Url from '../assets/images/lux_candle_9m_sapphire_v3_1794649630256.jpg'
import candleTier12Url from '../assets/images/lux_candle_12m_sovereign_v3_1794649630330.jpg'

export interface CertificateOptions {
  traderName?: string
  accountName?: string
  firmName?: string
  accountMeta?: string
  tierMonths?: ConsistencyTier
  currency?: string
  rangeLabel?: string
  issueDate?: string
  hideMoney?: boolean
}

interface TierDesign {
  tier: ConsistencyTier
  level: 1 | 2 | 3 | 4
  candleUrl: string
  candleDrawW: number
  headerTag: string
  kickerText: string
  titleText: string
  subtitleText: string
  editionSub: string
  sculptureTitle: string
  sculptureSubtitle: string
  canvasBg: string
  cardBgTop: string
  cardBgBottom: string
  stageBg: string
  stageHaloInner: string
  stageHaloOuter: string
  accentPrimary: string
  accentSecondary: string
  frameTop: string
  frameMid: string
  frameBottom: string
  frameWidth: number
  innerFrame: string | null
  topBeamColor: string | null
  topBeamWidth: number
  ambientWash: string
  nameMaxPx: number
  nameTop: string
  nameBottom: string
  ruleColor: string
  gridOpacity: number
  cornerDetail: 'none' | 'ticks' | 'brackets' | 'sovereign'
  sealMode: 'platinum' | 'emerald' | 'sapphire' | 'sovereign'
}

const TIER_DESIGNS: Record<ConsistencyTier, TierDesign> = {
  3: {
    tier: 3,
    level: 1,
    candleUrl: candleTier3Url,
    candleDrawW: 488,
    headerTag: 'LEVEL I  ·  03 MONTHS',
    kickerText: '03 CONSECUTIVE PROFITABLE MONTHS',
    titleText: 'Consistency Certificate',
    subtitleText: 'Foundation Quarter Milestone',
    editionSub: 'Tier I Consistency Record',
    sculptureTitle: 'SMOKED PLATINUM',
    sculptureSubtitle: 'Level I  ·  3-Month Edition',
    canvasBg: '#030508',
    cardBgTop: '#0A0D13',
    cardBgBottom: '#05070B',
    stageBg: '#030508',
    stageHaloInner: 'rgba(226, 232, 240, 0.13)',
    stageHaloOuter: 'rgba(148, 163, 184, 0.025)',
    accentPrimary: '#CBD5E1',
    accentSecondary: '#64748B',
    frameTop: 'rgba(203, 213, 225, 0.28)',
    frameMid: 'rgba(148, 163, 184, 0.14)',
    frameBottom: 'rgba(100, 116, 139, 0.09)',
    frameWidth: 1,
    innerFrame: null,
    topBeamColor: null,
    topBeamWidth: 0,
    ambientWash: 'rgba(203, 213, 225, 0.04)',
    nameMaxPx: 74,
    nameTop: '#FFFFFF',
    nameBottom: '#DCE3EC',
    ruleColor: 'rgba(203, 213, 225, 0.15)',
    gridOpacity: 0.025,
    cornerDetail: 'none',
    sealMode: 'platinum',
  },
  6: {
    tier: 6,
    level: 2,
    candleUrl: candleTier6Url,
    candleDrawW: 496,
    headerTag: 'LEVEL II  ·  06 MONTHS',
    kickerText: '06 CONSECUTIVE PROFITABLE MONTHS',
    titleText: 'Discipline Certificate',
    subtitleText: 'Half-Year Consistency Milestone',
    editionSub: 'Tier II Discipline Record',
    sculptureTitle: 'EMERALD CUT',
    sculptureSubtitle: 'Level II  ·  6-Month Edition',
    canvasBg: '#020406',
    cardBgTop: '#06100D',
    cardBgBottom: '#040807',
    stageBg: '#020405',
    stageHaloInner: 'rgba(52, 211, 153, 0.16)',
    stageHaloOuter: 'rgba(16, 185, 129, 0.03)',
    accentPrimary: '#34D399',
    accentSecondary: '#059669',
    frameTop: 'rgba(52, 211, 153, 0.36)',
    frameMid: 'rgba(16, 185, 129, 0.17)',
    frameBottom: 'rgba(5, 150, 105, 0.10)',
    frameWidth: 1.2,
    innerFrame: null,
    topBeamColor: 'rgba(52, 211, 153, 0.62)',
    topBeamWidth: 560,
    ambientWash: 'rgba(16, 185, 129, 0.055)',
    nameMaxPx: 76,
    nameTop: '#FFFFFF',
    nameBottom: '#D1FAE5',
    ruleColor: 'rgba(52, 211, 153, 0.18)',
    gridOpacity: 0.03,
    cornerDetail: 'ticks',
    sealMode: 'emerald',
  },
  9: {
    tier: 9,
    level: 3,
    candleUrl: candleTier9Url,
    candleDrawW: 500,
    headerTag: 'LEVEL III  ·  09 MONTHS',
    kickerText: '09 CONSECUTIVE PROFITABLE MONTHS',
    titleText: 'Executive Certificate',
    subtitleText: 'Three-Quarter Consistency Milestone',
    editionSub: 'Tier III Executive Record',
    sculptureTitle: 'SAPPHIRE LATTICE',
    sculptureSubtitle: 'Level III  ·  9-Month Edition',
    canvasBg: '#020408',
    cardBgTop: '#050B18',
    cardBgBottom: '#03060E',
    stageBg: '#020408',
    stageHaloInner: 'rgba(59, 130, 246, 0.20)',
    stageHaloOuter: 'rgba(37, 99, 235, 0.04)',
    accentPrimary: '#60A5FA',
    accentSecondary: '#2563EB',
    frameTop: 'rgba(96, 165, 250, 0.44)',
    frameMid: 'rgba(59, 130, 246, 0.20)',
    frameBottom: 'rgba(37, 99, 235, 0.12)',
    frameWidth: 1.3,
    innerFrame: 'rgba(96, 165, 250, 0.11)',
    topBeamColor: 'rgba(96, 165, 250, 0.78)',
    topBeamWidth: 820,
    ambientWash: 'rgba(37, 99, 235, 0.072)',
    nameMaxPx: 78,
    nameTop: '#FFFFFF',
    nameBottom: '#DBEAFE',
    ruleColor: 'rgba(96, 165, 250, 0.20)',
    gridOpacity: 0.035,
    cornerDetail: 'brackets',
    sealMode: 'sapphire',
  },
  12: {
    tier: 12,
    level: 4,
    candleUrl: candleTier12Url,
    candleDrawW: 508,
    headerTag: 'LEVEL IV  ·  12 MONTHS  ·  SOVEREIGN',
    kickerText: '12 CONSECUTIVE PROFITABLE MONTHS',
    titleText: 'Sovereign Certificate',
    subtitleText: 'Full-Year Consistency Distinction',
    editionSub: 'Tier IV Sovereign Distinction',
    sculptureTitle: 'SOVEREIGN ONYX & GOLD',
    sculptureSubtitle: 'Level IV  ·  12-Month Edition',
    canvasBg: '#020204',
    cardBgTop: '#0E0B07',
    cardBgBottom: '#050507',
    stageBg: '#020204',
    stageHaloInner: 'rgba(230, 193, 122, 0.19)',
    stageHaloOuter: 'rgba(184, 134, 59, 0.04)',
    accentPrimary: '#E6C17A',
    accentSecondary: '#B8863B',
    frameTop: 'rgba(230, 193, 122, 0.58)',
    frameMid: 'rgba(230, 193, 122, 0.26)',
    frameBottom: 'rgba(184, 134, 59, 0.16)',
    frameWidth: 1.5,
    innerFrame: 'rgba(230, 193, 122, 0.16)',
    topBeamColor: 'rgba(230, 193, 122, 0.90)',
    topBeamWidth: 1080,
    ambientWash: 'rgba(230, 193, 122, 0.065)',
    nameMaxPx: 80,
    nameTop: '#FFFFFF',
    nameBottom: '#F7E4BA',
    ruleColor: 'rgba(230, 193, 122, 0.24)',
    gridOpacity: 0.04,
    cornerDetail: 'sovereign',
    sealMode: 'sovereign',
  },
}

const TEXT_COLORS = {
  text: '#F8FAFC',
  text2: '#CBD5E1',
  muted: '#8E9BAE',
  faint: '#64748B',
  pos: '#34D399',
  shadow: 'rgba(0, 0, 0, 0.86)',
}

const DISPLAY_FONT = '"Plus Jakarta Sans", "InterVariable", Inter, system-ui, sans-serif'
const SANS_FONT = '"InterVariable", Inter, "DM Sans", system-ui, sans-serif'
const MONO_FONT = '"JetBrains Mono", "InterVariable", ui-monospace, monospace'

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.race([
      Promise.allSettled([
        document.fonts.load('800 80px "Plus Jakarta Sans"'),
        document.fonts.load('700 46px "Plus Jakarta Sans"'),
        document.fonts.load('600 14px "JetBrains Mono"'),
        document.fonts.load('500 20px "InterVariable"'),
        document.fonts.ready,
      ]),
      new Promise((resolve) => setTimeout(resolve, 650)),
    ])
  } catch {
    /* ignore */
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    let done = false
    const finish = (v: HTMLImageElement | null) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    img.onload = () => finish(img)
    img.onerror = () => finish(null)
    setTimeout(() => finish(null), 2000)
    img.src = src
  })
}

function cropOpaqueLogoBounds(
  img: HTMLImageElement,
): { sx: number; sy: number; sw: number; sh: number } {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return { sx: 0, sy: 0, sw: w, sh: h }
  try {
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')!
    octx.drawImage(img, 0, 0)
    const { data } = octx.getImageData(0, 0, w, h)
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < h; y += 2) {
      const row = y * w * 4
      for (let x = 0; x < w; x += 2) {
        if (data[row + x * 4 + 3] > 14) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX > minX && maxY > minY) {
      const pad = 4
      const sx = Math.max(0, minX - pad)
      const sy = Math.max(0, minY - pad)
      const ex = Math.min(w, maxX + pad)
      const ey = Math.min(h, maxY + pad)
      return { sx, sy, sw: ex - sx, sh: ey - sy }
    }
  } catch {
    /* ignore */
  }
  return { sx: 0, sy: 0, sw: w, sh: h }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: number,
  family: string,
): number {
  let size = maxSize
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 2
  }
  return size
}

function formatRangeText(raw?: string): string {
  if (!raw) return ''
  const arrowMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})$/)
  if (arrowMatch && isValidISODate(arrowMatch[1]) && isValidISODate(arrowMatch[2])) {
    return formatDateRange(arrowMatch[1], arrowMatch[2])
  }
  return raw
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makeCertId(seedStr: string): string {
  const hash = hashString(seedStr)
  const hex = hash.toString(16).toUpperCase().padStart(8, '0')
  return `TA-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

interface TextSegment {
  text: string
  bold?: boolean
}

function drawRichWrappedText(
  ctx: CanvasRenderingContext2D,
  segments: TextSegment[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  regularFont: string,
  boldFont: string,
  regularColor: string,
  boldColor: string,
) {
  const tokens: { word: string; bold: boolean }[] = []
  segments.forEach((seg) => {
    seg.text.split(/\s+/).filter(Boolean).forEach((word) => {
      tokens.push({ word, bold: Boolean(seg.bold) })
    })
  })

  const lines: { word: string; bold: boolean }[][] = []
  let currentLine: { word: string; bold: boolean }[] = []
  let currentWidth = 0

  for (const tok of tokens) {
    ctx.font = tok.bold ? boldFont : regularFont
    const isPunct = /^[.,;:!?]/.test(tok.word)
    const spaceW = currentLine.length > 0 && !isPunct ? ctx.measureText(' ').width : 0
    const wordW = ctx.measureText(tok.word).width
    if (currentLine.length > 0 && !isPunct && currentWidth + spaceW + wordW > maxWidth) {
      lines.push(currentLine)
      currentLine = [tok]
      currentWidth = wordW
    } else {
      currentLine.push(tok)
      currentWidth += spaceW + wordW
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  lines.forEach((line, li) => {
    let cx = x
    const cy = y + li * lineHeight
    line.forEach((tok, ti) => {
      ctx.font = tok.bold ? boldFont : regularFont
      ctx.fillStyle = tok.bold ? boldColor : regularColor
      const next = line[ti + 1]
      const addSpace = next && !/^[.,;:!?]/.test(next.word)
      const str = addSpace ? `${tok.word} ` : tok.word
      ctx.fillText(str, cx, cy)
      cx += ctx.measureText(str).width
    })
  })
}

function drawArchitecturalGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
) {
  ctx.save()
  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
  ctx.lineWidth = 1
  const step = 64

  for (let gx = x + step; gx < x + w; gx += step) {
    ctx.beginPath()
    ctx.moveTo(gx + 0.5, y)
    ctx.lineTo(gx + 0.5, y + h)
    ctx.stroke()
  }
  for (let gy = y + step; gy < y + h; gy += step) {
    ctx.beginPath()
    ctx.moveTo(x, gy + 0.5)
    ctx.lineTo(x + w, gy + 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCornerDetails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  design: TierDesign,
) {
  if (design.cornerDetail === 'none') return
  ctx.save()
  const inset = 22
  const len = design.cornerDetail === 'sovereign' ? 28 : design.cornerDetail === 'brackets' ? 20 : 14
  const corners = [
    { cx: x + inset, cy: y + inset, sx: 1, sy: 1 },
    { cx: x + w - inset, cy: y + inset, sx: -1, sy: 1 },
    { cx: x + inset, cy: y + h - inset, sx: 1, sy: -1 },
    { cx: x + w - inset, cy: y + h - inset, sx: -1, sy: -1 },
  ]

  ctx.strokeStyle = design.accentPrimary
  ctx.lineWidth = design.cornerDetail === 'sovereign' ? 1.4 : 1.1
  ctx.globalAlpha = design.cornerDetail === 'sovereign' ? 0.7 : design.cornerDetail === 'brackets' ? 0.5 : 0.38

  corners.forEach((c) => {
    ctx.beginPath()
    ctx.moveTo(c.cx + c.sx * len, c.cy)
    ctx.lineTo(c.cx, c.cy)
    ctx.lineTo(c.cx, c.cy + c.sy * len)
    ctx.stroke()

    if (design.cornerDetail === 'sovereign') {
      ctx.save()
      ctx.translate(c.cx + c.sx * 9, c.cy + c.sy * 9)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = design.accentPrimary
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8)
      ctx.restore()
    }
  })

  ctx.restore()
}

function prepareCrispCandleCanvas(
  img: HTMLImageElement,
  drawW: number,
  drawH: number,
): HTMLCanvasElement {
  const off = document.createElement('canvas')
  off.width = drawW
  off.height = drawH
  const octx = off.getContext('2d')!

  octx.filter = 'contrast(1.08) brightness(1.04) saturate(1.08)'
  octx.drawImage(img, 0, 0, drawW, drawH)
  octx.filter = 'none'

  const feather = 22
  octx.save()
  octx.globalCompositeOperation = 'destination-in'

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = drawW
  maskCanvas.height = drawH
  const mctx = maskCanvas.getContext('2d')!
  mctx.clearRect(0, 0, drawW, drawH)
  mctx.fillStyle = 'rgba(0,0,0,1)'
  roundRect(mctx, feather, feather, drawW - feather * 2, drawH - feather * 2, 16)
  mctx.shadowColor = 'rgba(0,0,0,1)'
  mctx.shadowBlur = feather * 1.4
  mctx.fill()

  octx.drawImage(maskCanvas, 0, 0)
  octx.restore()

  return off
}

function drawCandleFallback(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  design: TierDesign,
) {
  ctx.save()
  const bodyW = 124
  const bodyH = 300
  const bx = cx - bodyW / 2
  const by = cy - bodyH / 2

  ctx.fillStyle = design.accentPrimary
  ctx.beginPath()
  ctx.moveTo(cx, by - 96)
  ctx.lineTo(cx + 12, by)
  ctx.lineTo(cx - 12, by)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx, by + bodyH + 96)
  ctx.lineTo(cx + 12, by + bodyH)
  ctx.lineTo(cx - 12, by + bodyH)
  ctx.closePath()
  ctx.fill()

  roundRect(ctx, bx, by, bodyW, bodyH, 10)
  const grad = ctx.createLinearGradient(bx, by, bx + bodyW, by + bodyH)
  grad.addColorStop(0, design.accentPrimary)
  grad.addColorStop(1, design.accentSecondary)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()
}

function drawCandleShowcaseWing(
  ctx: CanvasRenderingContext2D,
  stageX: number,
  stageRight: number,
  plateTop: number,
  plateBottom: number,
  candleCx: number,
  candleCy: number,
  design: TierDesign,
  candleImg: HTMLImageElement | null,
) {
  ctx.save()

  const stageW = stageRight - stageX
  const stageH = plateBottom - plateTop

  // Open deep obsidian exhibition wing matching studio photography seamlessly
  ctx.fillStyle = design.stageBg
  ctx.fillRect(stageX, plateTop, stageW, stageH)

  // Calibrated atmospheric spotlight halo directly behind the sculpted candle
  const halo = ctx.createRadialGradient(candleCx, candleCy - 10, 12, candleCx, candleCy, 280)
  halo.addColorStop(0, design.stageHaloInner)
  halo.addColorStop(0.5, design.stageHaloOuter)
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.fillRect(stageX, plateTop, stageW, stageH)

  // Quiet vertical hairline separating editorial certificate and candle wing
  const stageDivGrad = ctx.createLinearGradient(0, plateTop + 44, 0, plateBottom - 44)
  stageDivGrad.addColorStop(0, 'rgba(255,255,255,0)')
  stageDivGrad.addColorStop(0.18, design.ruleColor)
  stageDivGrad.addColorStop(0.82, design.ruleColor)
  stageDivGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = stageDivGrad
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(stageX, plateTop + 44)
  ctx.lineTo(stageX, plateBottom - 44)
  ctx.stroke()

  if (candleImg && candleImg.naturalWidth > 0) {
    const drawW = Math.min(design.candleDrawW, stageW - 28)
    const drawH = Math.round((candleImg.naturalHeight / candleImg.naturalWidth) * drawW)
    const prepared = prepareCrispCandleCanvas(candleImg, drawW, drawH)

    ctx.drawImage(
      prepared,
      Math.round(candleCx - drawW / 2),
      Math.round(candleCy - drawH / 2),
    )
  } else {
    drawCandleFallback(ctx, candleCx, candleCy, design)
  }

  // Minimalist hairline & monument label below the candle
  const ruleW = 200
  const floorLineGrad = ctx.createLinearGradient(candleCx - ruleW / 2, 0, candleCx + ruleW / 2, 0)
  floorLineGrad.addColorStop(0, 'rgba(255,255,255,0)')
  floorLineGrad.addColorStop(0.5, design.frameTop)
  floorLineGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = floorLineGrad
  ctx.fillRect(candleCx - ruleW / 2, 834, ruleW, 1)

  ctx.textAlign = 'center'
  ctx.fillStyle = design.accentPrimary
  ctx.font = `600 11px ${MONO_FONT}`
  ctx.letterSpacing = '0.20em'
  ctx.fillText(design.sculptureTitle, candleCx, 870)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `500 12px ${SANS_FONT}`
  ctx.fillText(design.sculptureSubtitle, candleCx, 896)
  ctx.textAlign = 'left'

  ctx.restore()
}

function drawVerificationMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seedStr: string,
  accent: string,
  muted: string,
) {
  ctx.save()
  const size = 56
  const pad = 6
  const cells = 5
  const cellSize = (size - pad * 2) / cells
  const hash = hashString(seedStr)

  roundRect(ctx, x, y, size, size, 8)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.stroke()

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < Math.ceil(cells / 2); col++) {
      const bitIndex = (row * 3 + col) % 30
      const active = ((hash >> bitIndex) & 1) === 1 || (row === 2 && col === 2)
      if (!active) continue
      const isCorner = (row === 0 || row === cells - 1) && (col === 0 || col === cells - 1)
      ctx.fillStyle = isCorner || (row === 2 && col === 2) ? accent : muted
      const rx = x + pad + col * cellSize + 1
      const ry = y + pad + row * cellSize + 1
      const rw = cellSize - 2
      ctx.fillRect(rx, ry, rw, rw)

      const mirrorCol = cells - 1 - col
      if (mirrorCol !== col) {
        const mx = x + pad + mirrorCol * cellSize + 1
        ctx.fillRect(mx, ry, rw, rw)
      }
    }
  }
  ctx.restore()
}

function drawExecutiveSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  design: TierDesign,
) {
  ctx.save()

  if (design.sealMode === 'platinum') {
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.44)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, 35, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.18)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, 27, 0, Math.PI * 2)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = design.accentPrimary
    ctx.font = `700 12.5px ${MONO_FONT}`
    ctx.fillText('03M', cx, cy + 1)
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `600 7px ${MONO_FONT}`
    ctx.letterSpacing = '0.14em'
    ctx.fillText('TIER I', cx, cy + 12)
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    ctx.restore()
    return
  }

  if (design.sealMode === 'emerald') {
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.58)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(cx, cy, 37, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, 29, 0, Math.PI * 2)
    ctx.stroke()

    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * 33, cy + Math.sin(ang) * 33)
      ctx.lineTo(cx + Math.cos(ang) * 41, cy + Math.sin(ang) * 41)
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = design.accentPrimary
    ctx.font = `700 12.5px ${MONO_FONT}`
    ctx.fillText('06M', cx, cy + 1)
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `600 7px ${MONO_FONT}`
    ctx.letterSpacing = '0.14em'
    ctx.fillText('TIER II', cx, cy + 12)
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    ctx.restore()
    return
  }

  const isSovereign = design.sealMode === 'sovereign'
  const ringColor = isSovereign ? 'rgba(230, 193, 122, 0.82)' : 'rgba(96, 165, 250, 0.65)'
  const innerRingColor = isSovereign ? 'rgba(230, 193, 122, 0.36)' : 'rgba(96, 165, 250, 0.28)'

  const ticks = isSovereign ? 24 : 12
  ctx.strokeStyle = ringColor
  ctx.lineWidth = isSovereign ? 1.3 : 1.1
  for (let t = 0; t < ticks; t++) {
    const ang = (t * Math.PI * 2) / ticks
    const r0 = isSovereign ? 38 : 37
    const r1 = isSovereign ? 45 : 42
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0)
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
    ctx.stroke()
  }

  ctx.strokeStyle = ringColor
  ctx.lineWidth = isSovereign ? 1.5 : 1.3
  ctx.beginPath()
  ctx.arc(cx, cy, 37, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = innerRingColor
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.arc(cx, cy, 28, 0, Math.PI * 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = design.accentPrimary
  ctx.font = `700 13.5px ${MONO_FONT}`
  ctx.fillText(isSovereign ? '12M' : '09M', cx, cy + 1)

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `600 7px ${MONO_FONT}`
  ctx.letterSpacing = '0.13em'
  ctx.fillText(isSovereign ? 'SOVEREIGN' : 'TIER III', cx, cy + 12)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'

  ctx.restore()
}

export async function renderCertificateCard(
  stats: Stats,
  opts: CertificateOptions = {},
): Promise<HTMLCanvasElement> {
  const tierMonths: ConsistencyTier = opts.tierMonths ?? 3
  const design = TIER_DESIGNS[tierMonths] ?? TIER_DESIGNS[3]

  const W = 1600
  const H = 1000

  await ensureFonts()
  const [logoImg, candleImg] = await Promise.all([
    loadImage(logoDarkUrl),
    loadImage(design.candleUrl),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const traderName = (opts.traderName || 'Trader').trim() || 'Trader'
  const rangeText = formatRangeText(opts.rangeLabel)

  const issueText =
    opts.issueDate ||
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const certCode = makeCertId(
    `${traderName}|${tierMonths}M|${rangeText || 'streak'}|${stats.count}`,
  )

  // 1. Canvas Backdrop & Layered Plate
  ctx.fillStyle = design.canvasBg
  ctx.fillRect(0, 0, W, H)

  const pad = 20
  const cardW = W - pad * 2
  const cardH = H - pad * 2
  const plateTop = pad
  const plateBottom = pad + cardH
  const plateRight = pad + cardW

  ctx.save()
  roundRect(ctx, pad, pad, cardW, cardH, 20)
  const plateGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + cardH)
  plateGrad.addColorStop(0, design.cardBgTop)
  plateGrad.addColorStop(1, design.cardBgBottom)
  ctx.fillStyle = plateGrad
  ctx.shadowColor = TEXT_COLORS.shadow
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  ctx.fill()
  ctx.restore()

  const stageDivX = 1018
  const candleCx = Math.round(stageDivX + (plateRight - stageDivX) / 2)
  const candleCy = 468

  ctx.save()
  roundRect(ctx, pad, pad, cardW, cardH, 20)
  ctx.clip()

  drawArchitecturalGrid(ctx, pad, pad, stageDivX - pad, cardH, design.gridOpacity)

  const leftWash = ctx.createRadialGradient(240, 200, 20, 240, 200, 700)
  leftWash.addColorStop(0, design.ambientWash)
  leftWash.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = leftWash
  ctx.fillRect(pad, pad, stageDivX - pad, cardH)

  // Right-Side Open Exhibition Wing with Sharp Sculpted Candle
  drawCandleShowcaseWing(
    ctx,
    stageDivX,
    plateRight,
    plateTop,
    plateBottom,
    candleCx,
    candleCy,
    design,
    candleImg,
  )

  if (design.topBeamColor && design.topBeamWidth > 0) {
    const halfBeam = design.topBeamWidth / 2
    const topBeam = ctx.createLinearGradient(W / 2 - halfBeam, 0, W / 2 + halfBeam, 0)
    topBeam.addColorStop(0, 'rgba(255,255,255,0)')
    topBeam.addColorStop(0.5, design.topBeamColor)
    topBeam.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = topBeam
    ctx.fillRect(W / 2 - halfBeam, pad, design.topBeamWidth, design.level === 4 ? 2.5 : 2)
  }

  if (design.innerFrame) {
    roundRect(ctx, pad + 11, pad + 11, cardW - 22, cardH - 22, 14)
    ctx.strokeStyle = design.innerFrame
    ctx.lineWidth = 1
    ctx.stroke()
  }

  drawCornerDetails(ctx, pad, pad, cardW, cardH, design)

  ctx.restore()

  // Crisp Outer Metallic Frame
  roundRect(ctx, pad, pad, cardW, cardH, 20)
  const frameGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + cardH)
  frameGrad.addColorStop(0, design.frameTop)
  frameGrad.addColorStop(0.5, design.frameMid)
  frameGrad.addColorStop(1, design.frameBottom)
  ctx.strokeStyle = frameGrad
  ctx.lineWidth = design.frameWidth
  ctx.stroke()

  // 2. Left Editorial Certificate (Zero trading stats, purely milestone certification)
  const innerX = 88
  const leftRight = 964
  const leftW = leftRight - innerX

  // Header Bar
  const headerCenterY = 82
  if (logoImg && logoImg.naturalWidth > 0) {
    const crop = cropOpaqueLogoBounds(logoImg)
    const targetLogoH = 34
    const targetLogoW = Math.round((crop.sw / crop.sh) * targetLogoH)
    ctx.drawImage(
      logoImg,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      innerX,
      Math.round(headerCenterY - targetLogoH / 2),
      targetLogoW,
      targetLogoH,
    )
  } else {
    ctx.fillStyle = TEXT_COLORS.text
    ctx.font = `700 22px ${DISPLAY_FONT}`
    ctx.fillText('Traders Area', innerX, headerCenterY + 8)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `600 11.5px ${MONO_FONT}`
  ctx.fillText(`${design.headerTag}   ·   ${certCode}`, leftRight, headerCenterY + 4)
  ctx.textAlign = 'left'

  const hRuleGrad = ctx.createLinearGradient(innerX, 0, leftRight, 0)
  hRuleGrad.addColorStop(0, design.ruleColor)
  hRuleGrad.addColorStop(0.85, design.ruleColor)
  hRuleGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hRuleGrad
  ctx.fillRect(innerX, 128, leftW, 1)

  // Milestone Kicker & Monumental Title
  const kickerY = 196
  const kickerBarW = 20 + design.level * 5
  ctx.fillStyle = design.accentPrimary
  ctx.fillRect(innerX, kickerY - 5, kickerBarW, 2.5)

  ctx.fillStyle = design.accentPrimary
  ctx.font = `600 12px ${MONO_FONT}`
  ctx.letterSpacing = '0.18em'
  ctx.fillText(design.kickerText, innerX + kickerBarW + 12, kickerY)
  ctx.letterSpacing = '0px'

  ctx.font = `700 48px ${DISPLAY_FONT}`
  ctx.letterSpacing = '-0.03em'
  const titleGrad = ctx.createLinearGradient(0, 218, 0, 272)
  titleGrad.addColorStop(0, '#FFFFFF')
  titleGrad.addColorStop(1, design.level === 4 ? '#EAD7B0' : '#DCE4EE')
  ctx.fillStyle = titleGrad
  ctx.fillText(design.titleText, innerX, 260)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `500 16px ${SANS_FONT}`
  ctx.fillText(design.subtitleText, innerX, 294)

  // Recipient Hero Block
  ctx.fillStyle = TEXT_COLORS.faint
  ctx.font = `600 11px ${MONO_FONT}`
  ctx.letterSpacing = '0.2em'
  ctx.fillText('PRESENTED TO', innerX, 376)
  ctx.letterSpacing = '0px'

  const nameSize = fitFontSize(ctx, traderName, leftW - 12, design.nameMaxPx, 40, 800, DISPLAY_FONT)
  ctx.font = `800 ${nameSize}px ${DISPLAY_FONT}`
  ctx.letterSpacing = '-0.035em'
  const nameGrad = ctx.createLinearGradient(0, 396, 0, 472)
  nameGrad.addColorStop(0, design.nameTop)
  nameGrad.addColorStop(1, design.nameBottom)
  ctx.fillStyle = nameGrad
  ctx.fillText(traderName, innerX, 456)
  ctx.letterSpacing = '0px'

  // Calibrated hairline beneath name
  const nameRuleW = 240 + design.level * 40
  if (design.level === 4) {
    ctx.save()
    ctx.translate(innerX + 4, 487)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = design.accentPrimary
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8)
    ctx.restore()
  }
  const ruleStartX = design.level === 4 ? innerX + 14 : innerX
  const nameRuleGrad = ctx.createLinearGradient(ruleStartX, 0, innerX + nameRuleW, 0)
  nameRuleGrad.addColorStop(0, design.accentPrimary)
  nameRuleGrad.addColorStop(0.62, design.accentSecondary)
  nameRuleGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = nameRuleGrad
  ctx.fillRect(ruleStartX, 486, nameRuleW - (ruleStartX - innerX), design.level >= 3 ? 2 : 1.5)

  // Pure Consistency Citation (No trading stats)
  drawRichWrappedText(
    ctx,
    [
      { text: 'In recognition of achieving ' },
      { text: `${tierMonths} consecutive profitable calendar months`, bold: true },
      {
        text: ' through sustained consistency, disciplined risk management, and verified monthly profitability.',
      },
    ],
    innerX,
    534,
    836,
    30,
    `400 19px ${SANS_FONT}`,
    `600 19px ${SANS_FONT}`,
    TEXT_COLORS.text2,
    TEXT_COLORS.text,
  )

  // Minimalist 3-Column Milestone Metadata Strip (No stats card, no P&L/winrate/trades)
  const stripY = 668
  const stripH = 84
  ctx.fillStyle = design.ruleColor
  ctx.fillRect(innerX, stripY, leftW, 1)
  ctx.fillRect(innerX, stripY + stripH, leftW, 1)

  const colW = leftW / 3
  const milestones = [
    {
      label: 'CONSISTENCY STREAK',
      value: `${tierMonths} Months`,
      color: TEXT_COLORS.text,
    },
    {
      label: 'QUALIFYING PERIOD',
      value: rangeText || `${tierMonths}-Month Run`,
      color: TEXT_COLORS.text,
    },
    {
      label: 'VERIFICATION STATUS',
      value: 'Profitable Streak',
      color: design.level === 4 ? design.accentPrimary : TEXT_COLORS.pos,
    },
  ]

  milestones.forEach((item, idx) => {
    const cx = innerX + idx * colW + (idx === 0 ? 0 : 24)
    if (idx > 0) {
      ctx.fillStyle = design.ruleColor
      ctx.fillRect(innerX + idx * colW, stripY + 18, 1, stripH - 36)
    }
    ctx.fillStyle = TEXT_COLORS.faint
    ctx.font = `600 10.5px ${MONO_FONT}`
    ctx.letterSpacing = '0.16em'
    ctx.fillText(item.label, cx, stripY + 31)
    ctx.letterSpacing = '0px'

    const valSize = fitFontSize(ctx, item.value, colW - 32, 20, 14, 600, DISPLAY_FONT)
    ctx.fillStyle = item.color
    ctx.font = `600 ${valSize}px ${DISPLAY_FONT}`
    ctx.fillText(item.value, cx, stripY + 60)
  })

  // 3. Institutional Verification Footer
  const footY = 824
  drawVerificationMatrix(
    ctx,
    innerX,
    footY,
    certCode,
    design.accentPrimary,
    'rgba(148, 163, 184, 0.55)',
  )

  const authX = innerX + 76
  ctx.fillStyle = design.accentPrimary
  ctx.font = `600 10.5px ${MONO_FONT}`
  ctx.letterSpacing = '0.18em'
  ctx.fillText('VERIFIED BY TRADERS AREA', authX, footY + 14)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = TEXT_COLORS.text
  ctx.font = `600 16px ${DISPLAY_FONT}`
  ctx.fillText(design.editionSub, authX, footY + 38)

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `500 12.5px ${MONO_FONT}`
  ctx.fillText(`ISSUED ${issueText.toUpperCase()}`, authX, footY + 57)

  drawExecutiveSeal(ctx, leftRight - 46, footY + 28, design)

  return canvas
}

export async function renderCertificateBlob(stats: Stats, opts: CertificateOptions = {}): Promise<Blob> {
  const canvas = await renderCertificateCard(stats, opts)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to render certificate')
  return blob
}

export async function certificateDataUrl(stats: Stats, opts: CertificateOptions = {}): Promise<string> {
  const canvas = await renderCertificateCard(stats, opts)
  return canvas.toDataURL('image/png')
}

export async function downloadCertificateCard(stats: Stats, opts: CertificateOptions = {}): Promise<void> {
  const blob = await renderCertificateBlob(stats, opts)
  const tierSuffix = opts.tierMonths ? `-${opts.tierMonths}m` : ''
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `traders-area-certificate${tierSuffix}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function copyCertificateCard(stats: Stats, opts: CertificateOptions = {}): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard image copy is not supported in this browser')
  }
  const blob = await renderCertificateBlob(stats, opts)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function shareCertificateCard(stats: Stats, opts: CertificateOptions = {}): Promise<void> {
  const blob = await renderCertificateBlob(stats, opts)
  const tierSuffix = opts.tierMonths ? `-${opts.tierMonths}m` : ''
  const file = new File([blob], `traders-area-certificate${tierSuffix}.png`, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({
        files: [file],
        title: 'Trading performance certificate',
        text: 'Traders Area — Verified Consistency Certificate',
      })
      return
    } catch {
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `traders-area-certificate${tierSuffix}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
