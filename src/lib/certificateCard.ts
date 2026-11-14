import type { Stats } from '@/lib/types'
import type { ConsistencyTier } from '@/lib/certificates'
import { formatDateRange, isValidISODate } from '@/lib/dates'
import { formatMoney, signedPercent } from '@/lib/format'
import logoDarkUrl from '../../assets/logodark.png'
import candleTier3Url from '../assets/images/candle_lux_3m_quartz_1794589443843.jpg'
import candleTier6Url from '../assets/images/candle_lux_6m_sapphire_v2_1794589468407.jpg'
import candleTier9Url from '../assets/images/candle_lux_9m_baguette_1794589444088.jpg'
import candleTier12Url from '../assets/images/candle_lux_12m_imperial_v2_1794589468313.jpg'

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
  candleUrl: string
  candleDrawW: number
  candleCyOffset: number
  headerTag: string
  kickerText: string
  editionSub: string
  stageLabel: string
  canvasBg: string
  cardBgTop: string
  cardBgBottom: string
  accentPrimary: string
  accentSecondary: string
  frameTop: string
  frameMid: string
  frameBottom: string
  innerFrame: string | null
  topBeamColor: string
  topBeamWidth: number
  ambientWash: string
  nameTop: string
  nameBottom: string
  statsBgTop: string
  statsBgBottom: string
  statsBorderTop: string
  statsBorderBottom: string
  statsBeam: string
  dividerColor: string
  dotOpacity: number
  cornerStyle: 'ticks' | 'brackets' | 'mitered' | 'sovereign'
  sealMode: 'diamond' | 'cobalt' | 'titanium' | 'sovereign'
}

const TIER_DESIGNS: Record<ConsistencyTier, TierDesign> = {
  3: {
    tier: 3,
    candleUrl: candleTier3Url,
    candleDrawW: 468,
    candleCyOffset: 0,
    headerTag: '03 MONTHS',
    kickerText: '03 MONTHS  ·  CONSISTENT PROFITS',
    editionSub: 'Verified Consistency Ledger',
    stageLabel: 'ICE QUARTZ EDITION',
    canvasBg: '#030509',
    cardBgTop: '#070b14',
    cardBgBottom: '#03060c',
    accentPrimary: '#bae6fd',
    accentSecondary: '#60a5fa',
    frameTop: 'rgba(186, 230, 253, 0.24)',
    frameMid: 'rgba(148, 163, 184, 0.12)',
    frameBottom: 'rgba(96, 165, 250, 0.08)',
    innerFrame: null,
    topBeamColor: 'rgba(186, 230, 253, 0.48)',
    topBeamWidth: 560,
    ambientWash: 'rgba(147, 197, 253, 0.065)',
    nameTop: '#ffffff',
    nameBottom: '#e2e8f0',
    statsBgTop: 'rgba(255, 255, 255, 0.032)',
    statsBgBottom: 'rgba(255, 255, 255, 0.012)',
    statsBorderTop: 'rgba(186, 230, 253, 0.20)',
    statsBorderBottom: 'rgba(148, 163, 184, 0.09)',
    statsBeam: 'rgba(186, 230, 253, 0.24)',
    dividerColor: 'rgba(186, 230, 253, 0.15)',
    dotOpacity: 0.14,
    cornerStyle: 'ticks',
    sealMode: 'diamond',
  },
  6: {
    tier: 6,
    candleUrl: candleTier6Url,
    candleDrawW: 480,
    candleCyOffset: 0,
    headerTag: '06 MONTHS',
    kickerText: '06 MONTHS  ·  CONSISTENT PROFITS',
    editionSub: 'Verified Proven Discipline',
    stageLabel: 'ROYAL COBALT EDITION',
    canvasBg: '#02040a',
    cardBgTop: '#050a18',
    cardBgBottom: '#02050c',
    accentPrimary: '#60a5fa',
    accentSecondary: '#2563eb',
    frameTop: 'rgba(96, 165, 250, 0.34)',
    frameMid: 'rgba(59, 130, 246, 0.16)',
    frameBottom: 'rgba(37, 99, 235, 0.10)',
    innerFrame: 'rgba(59, 130, 246, 0.10)',
    topBeamColor: 'rgba(59, 130, 246, 0.72)',
    topBeamWidth: 780,
    ambientWash: 'rgba(37, 99, 235, 0.09)',
    nameTop: '#ffffff',
    nameBottom: '#dbeafe',
    statsBgTop: 'rgba(37, 99, 235, 0.055)',
    statsBgBottom: 'rgba(255, 255, 255, 0.014)',
    statsBorderTop: 'rgba(96, 165, 250, 0.30)',
    statsBorderBottom: 'rgba(37, 99, 235, 0.12)',
    statsBeam: 'rgba(96, 165, 250, 0.32)',
    dividerColor: 'rgba(96, 165, 250, 0.20)',
    dotOpacity: 0.18,
    cornerStyle: 'brackets',
    sealMode: 'cobalt',
  },
  9: {
    tier: 9,
    candleUrl: candleTier9Url,
    candleDrawW: 492,
    candleCyOffset: 0,
    headerTag: '09 MONTHS',
    kickerText: '09 MONTHS  ·  EXECUTIVE CONSISTENCY',
    editionSub: 'Executive Performance Distinction',
    stageLabel: 'BAGUETTE SAPPHIRE EDITION',
    canvasBg: '#020409',
    cardBgTop: '#040917',
    cardBgBottom: '#02050b',
    accentPrimary: '#7dd3fc',
    accentSecondary: '#0284c7',
    frameTop: 'rgba(125, 211, 252, 0.40)',
    frameMid: 'rgba(56, 189, 248, 0.18)',
    frameBottom: 'rgba(37, 99, 235, 0.12)',
    innerFrame: 'rgba(125, 211, 252, 0.13)',
    topBeamColor: 'rgba(125, 211, 252, 0.80)',
    topBeamWidth: 960,
    ambientWash: 'rgba(14, 165, 233, 0.09)',
    nameTop: '#ffffff',
    nameBottom: '#e0f2fe',
    statsBgTop: 'rgba(56, 189, 248, 0.055)',
    statsBgBottom: 'rgba(255, 255, 255, 0.016)',
    statsBorderTop: 'rgba(125, 211, 252, 0.34)',
    statsBorderBottom: 'rgba(56, 189, 248, 0.14)',
    statsBeam: 'rgba(125, 211, 252, 0.36)',
    dividerColor: 'rgba(125, 211, 252, 0.22)',
    dotOpacity: 0.22,
    cornerStyle: 'mitered',
    sealMode: 'titanium',
  },
  12: {
    tier: 12,
    candleUrl: candleTier12Url,
    candleDrawW: 504,
    candleCyOffset: 0,
    headerTag: '12 MONTHS  ·  SOVEREIGN',
    kickerText: '12 MONTHS  ·  SOVEREIGN CONSISTENCY',
    editionSub: 'Annual Sovereign Distinction',
    stageLabel: 'IMPERIAL SOVEREIGN EDITION',
    canvasBg: '#020306',
    cardBgTop: '#060812',
    cardBgBottom: '#020308',
    accentPrimary: '#e6c17a',
    accentSecondary: '#3b82f6',
    frameTop: 'rgba(230, 193, 122, 0.50)',
    frameMid: 'rgba(96, 165, 250, 0.20)',
    frameBottom: 'rgba(230, 193, 122, 0.22)',
    innerFrame: 'rgba(230, 193, 122, 0.16)',
    topBeamColor: 'rgba(230, 193, 122, 0.88)',
    topBeamWidth: 1120,
    ambientWash: 'rgba(37, 99, 235, 0.095)',
    nameTop: '#ffffff',
    nameBottom: '#f7e9cd',
    statsBgTop: 'rgba(230, 193, 122, 0.05)',
    statsBgBottom: 'rgba(37, 99, 235, 0.02)',
    statsBorderTop: 'rgba(230, 193, 122, 0.38)',
    statsBorderBottom: 'rgba(96, 165, 250, 0.16)',
    statsBeam: 'rgba(230, 193, 122, 0.40)',
    dividerColor: 'rgba(230, 193, 122, 0.24)',
    dotOpacity: 0.24,
    cornerStyle: 'sovereign',
    sealMode: 'sovereign',
  },
}

const TEXT_COLORS = {
  text: '#f8fafc',
  text2: '#cbd5e1',
  muted: '#8492a6',
  pos: '#34d399',
  neg: '#f87171',
  shadow: 'rgba(0, 0, 0, 0.78)',
}

const DISPLAY_FONT = '"Plus Jakarta Sans", "InterVariable", Inter, system-ui, sans-serif'
const SANS_FONT = '"InterVariable", Inter, "DM Sans", system-ui, sans-serif'
const MONO_FONT = '"JetBrains Mono", "InterVariable", ui-monospace, monospace'

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.race([
      Promise.allSettled([
        document.fonts.load('800 76px "Plus Jakarta Sans"'),
        document.fonts.load('600 42px "Plus Jakarta Sans"'),
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

function signedUsd(n: number): string {
  const v = Number(n) || 0
  if (Math.abs(v) < 0.005) return '$0.00'
  const abs = Math.abs(v)
  const sign = v > 0 ? '+' : '-'
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function drawDotMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacityScale: number,
  candleCx: number,
  candleCy: number,
) {
  if (opacityScale <= 0) return
  ctx.save()
  const step = 30
  ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'
  for (let gx = x + 32; gx < x + w - 24; gx += step) {
    for (let gy = y + 32; gy < y + h - 24; gy += step) {
      const nx = (gx - x) / w
      const ny = (gy - y) / h
      if (nx < 0.65 && ny > 0.13 && ny < 0.92) continue
      const dx = (gx - candleCx) / 175
      const dy = (gy - candleCy) / 305
      if (Math.hypot(dx, dy) < 1.12) continue

      ctx.globalAlpha = opacityScale * (nx > 0.64 ? 0.85 : 0.35)
      ctx.beginPath()
      ctx.arc(gx, gy, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawCornerAccents(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  design: TierDesign,
) {
  ctx.save()
  const inset = 18
  const len =
    design.cornerStyle === 'sovereign'
      ? 28
      : design.cornerStyle === 'mitered'
        ? 22
        : design.cornerStyle === 'brackets'
          ? 18
          : 12

  const corners = [
    { cx: x + inset, cy: y + inset, sx: 1, sy: 1 },
    { cx: x + w - inset, cy: y + inset, sx: -1, sy: 1 },
    { cx: x + inset, cy: y + h - inset, sx: 1, sy: -1 },
    { cx: x + w - inset, cy: y + h - inset, sx: -1, sy: -1 },
  ]

  ctx.strokeStyle = design.accentPrimary
  ctx.lineWidth = design.cornerStyle === 'sovereign' ? 1.5 : 1.15
  ctx.globalAlpha =
    design.cornerStyle === 'ticks'
      ? 0.42
      : design.cornerStyle === 'brackets'
        ? 0.52
        : design.cornerStyle === 'mitered'
          ? 0.62
          : 0.72

  corners.forEach((c) => {
    ctx.beginPath()
    ctx.moveTo(c.cx + c.sx * len, c.cy)
    ctx.lineTo(c.cx, c.cy)
    ctx.lineTo(c.cx, c.cy + c.sy * len)
    ctx.stroke()

    if (design.cornerStyle === 'mitered' || design.cornerStyle === 'sovereign') {
      ctx.beginPath()
      ctx.moveTo(c.cx + c.sx * (len - 8), c.cy + c.sy * 5)
      ctx.lineTo(c.cx + c.sx * 5, c.cy + c.sy * 5)
      ctx.lineTo(c.cx + c.sx * 5, c.cy + c.sy * (len - 8))
      ctx.stroke()
    }

    if (design.cornerStyle === 'sovereign') {
      ctx.fillStyle = design.accentSecondary
      ctx.beginPath()
      ctx.arc(c.cx + c.sx * 10, c.cy + c.sy * 10, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.restore()
}

/**
 * Flood-fills from exterior edges of the offscreen candle canvas to cleanly
 * key out the flat dark studio backdrop while preserving 100% of dark titanium,
 * gunmetal PVD grooves, crystal interiors, and wicks without lighten washout.
 */
function keyOutExteriorBackdrop(canvas: HTMLCanvasElement, threshold = 24) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  const total = w * h

  const isBg = (idx: number) => {
    const p = idx * 4
    const maxC = Math.max(data[p], data[p + 1], data[p + 2])
    return maxC <= threshold
  }

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const seed = (idx: number) => {
    if (!visited[idx] && isBg(idx)) {
      visited[idx] = 1
      queue[tail++] = idx
    }
  }

  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    seed(y * w)
    seed(y * w + (w - 1))
  }

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % w
    const y = (idx - x) / w

    if (x > 0) seed(idx - 1)
    if (x < w - 1) seed(idx + 1)
    if (y > 0) seed(idx - w)
    if (y < h - 1) seed(idx + w)
  }

  // Zero out flood-filled exterior background and anti-alias 1px boundary pixels
  for (let i = 0; i < total; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0
    } else {
      const x = i % w
      const y = (i - x) / w
      let bgNeighbors = 0
      if (x > 0 && visited[i - 1]) bgNeighbors++
      if (x < w - 1 && visited[i + 1]) bgNeighbors++
      if (y > 0 && visited[i - w]) bgNeighbors++
      if (y < h - 1 && visited[i + w]) bgNeighbors++
      if (bgNeighbors > 0) {
        const p = i * 4
        const maxC = Math.max(data[p], data[p + 1], data[p + 2])
        const edgeAlpha = Math.min(255, Math.max(0, Math.round(((maxC - 10) / 28) * 255)))
        data[p + 3] = Math.min(data[p + 3], edgeAlpha)
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
}

function drawBlueCandleFallback(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  design: TierDesign,
) {
  ctx.save()

  const bodyW = 136
  const bodyH = 330
  const bx = cx - bodyW / 2
  const by = cy - bodyH / 2
  const wickW = 8
  const wickX = cx - wickW / 2

  const drawWick = (wx: number, wy: number, ww: number, wh: number) => {
    const wGrad = ctx.createLinearGradient(wx, 0, wx + ww, 0)
    wGrad.addColorStop(0, '#e2e8f0')
    wGrad.addColorStop(0.5, design.accentPrimary)
    wGrad.addColorStop(1, '#475569')
    roundRect(ctx, wx, wy, ww, wh, ww / 2)
    ctx.fillStyle = wGrad
    ctx.fill()
  }

  drawWick(wickX, by - 92, wickW, 98)
  drawWick(wickX, by + bodyH - 6, wickW, 92)

  roundRect(ctx, bx, by, bodyW, bodyH, 12)
  ctx.fillStyle = design.accentSecondary
  ctx.fill()

  ctx.save()
  roundRect(ctx, bx, by, bodyW, bodyH, 12)
  ctx.clip()

  const leftGrad = ctx.createLinearGradient(bx, by, cx, by + bodyH)
  leftGrad.addColorStop(0, design.accentPrimary)
  leftGrad.addColorStop(1, '#1d4ed8')
  ctx.fillStyle = leftGrad
  ctx.fillRect(bx, by, bodyW / 2, bodyH)

  const rightGrad = ctx.createLinearGradient(cx, by, bx + bodyW, by + bodyH)
  rightGrad.addColorStop(0, '#93c5fd')
  rightGrad.addColorStop(1, '#1e40af')
  ctx.fillStyle = rightGrad
  ctx.fillRect(cx, by, bodyW / 2, bodyH)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, by)
  ctx.lineTo(cx, by + bodyH)
  ctx.stroke()
  ctx.restore()

  roundRect(ctx, bx, by, bodyW, bodyH, 12)
  ctx.strokeStyle = design.frameTop
  ctx.lineWidth = 1.25
  ctx.stroke()

  ctx.restore()
}

function drawCandleShowcaseStage(
  ctx: CanvasRenderingContext2D,
  stageX: number,
  candleCx: number,
  candleCy: number,
  design: TierDesign,
  candleImg: HTMLImageElement | null,
) {
  ctx.save()

  // Quiet hairline vertical rule separating editorial ledger from crystal stage
  const stageDivGrad = ctx.createLinearGradient(0, 170, 0, 880)
  stageDivGrad.addColorStop(0, 'rgba(255,255,255,0)')
  stageDivGrad.addColorStop(0.5, design.dividerColor)
  stageDivGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = stageDivGrad
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(stageX, 170)
  ctx.lineTo(stageX, 880)
  ctx.stroke()

  if (candleImg && candleImg.naturalWidth > 0) {
    const drawW = design.candleDrawW
    const drawH = Math.round((candleImg.naturalHeight / candleImg.naturalWidth) * drawW)

    const off = document.createElement('canvas')
    off.width = drawW
    off.height = drawH
    const octx = off.getContext('2d')!

    octx.filter = 'brightness(1.06) contrast(1.07) saturate(1.08)'
    octx.drawImage(candleImg, 0, 0, drawW, drawH)
    octx.filter = 'none'

    keyOutExteriorBackdrop(off, 20)

    // Subtle soft obsidian drop-shadow so floating crystal sits richly above plate
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 16
    ctx.drawImage(off, Math.round(candleCx - drawW / 2), Math.round(candleCy - drawH / 2))
    ctx.restore()
  } else {
    drawBlueCandleFallback(ctx, candleCx, candleCy, design)
  }

  // Quiet centered edition caption beneath showcase crystal
  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `600 9.5px ${MONO_FONT}`
  ctx.letterSpacing = '0.18em'
  ctx.fillText(design.stageLabel, candleCx, 902)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'

  ctx.restore()
}

function drawCeoSignature(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  accent: string,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Subtle shadow depth under pen ink
  ctx.strokeStyle = color

  // Main calligraphic initial & stroke with deliberate fountain-pen weight contrast
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(x + 2, y + 32)
  ctx.bezierCurveTo(x + 12, y - 5, x + 38, y - 12, x + 40, y + 8)
  ctx.bezierCurveTo(x + 42, y + 24, x + 20, y + 35, x + 46, y + 28)
  ctx.stroke()

  ctx.lineWidth = 1.9
  ctx.beginPath()
  ctx.moveTo(x + 46, y + 28)
  ctx.bezierCurveTo(x + 64, y + 22, x + 72, y + 6, x + 82, y + 20)
  ctx.bezierCurveTo(x + 90, y + 31, x + 100, y + 9, x + 110, y + 20)
  ctx.bezierCurveTo(x + 118, y + 29, x + 130, y + 11, x + 140, y + 22)
  ctx.bezierCurveTo(x + 150, y + 31, x + 164, y + 14, x + 178, y + 22)
  ctx.bezierCurveTo(x + 194, y + 26, x + 222, y + 13, x + 252, y + 16)
  ctx.stroke()

  // Crisp ascender cross-flourish with subtle accent glint
  ctx.lineWidth = 1.5
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.72
  ctx.beginPath()
  ctx.moveTo(x + 14, y + 12)
  ctx.bezierCurveTo(x + 44, y + 2, x + 74, y + 1, x + 98, y + 7)
  ctx.stroke()

  ctx.restore()
}

function drawExecutiveSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  design: TierDesign,
) {
  ctx.save()

  if (design.sealMode === 'diamond') {
    // 3M: Precision rotated diamond + inner circular hairline seal
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.42)'
    ctx.lineWidth = 1.1
    ctx.strokeRect(-24, -24, 48, 48)
    ctx.restore()

    ctx.strokeStyle = 'rgba(147, 197, 253, 0.22)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = design.accentPrimary
    ctx.font = `700 11px ${MONO_FONT}`
    ctx.fillText('03M', cx, cy + 1)
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `600 6.5px ${MONO_FONT}`
    ctx.letterSpacing = '0.12em'
    ctx.fillText('CLASS I', cx, cy + 11)
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    ctx.restore()
    return
  }

  if (design.sealMode === 'cobalt') {
    // 6M: Precision dual cobalt rings with 4 cardinal reticle ticks
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(cx, cy, 36, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.26)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    ctx.stroke()

    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * 32, cy + Math.sin(ang) * 32)
      ctx.lineTo(cx + Math.cos(ang) * 39, cy + Math.sin(ang) * 39)
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = design.accentPrimary
    ctx.font = `700 12px ${MONO_FONT}`
    ctx.fillText('06M', cx, cy + 1)
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `600 7px ${MONO_FONT}`
    ctx.letterSpacing = '0.14em'
    ctx.fillText('PROVEN', cx, cy + 12)
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    ctx.restore()
    return
  }

  const isSovereign = design.sealMode === 'sovereign'
  const ringColor = isSovereign ? 'rgba(230, 193, 122, 0.72)' : 'rgba(186, 230, 253, 0.56)'
  const innerRingColor = isSovereign ? 'rgba(230, 193, 122, 0.34)' : 'rgba(125, 211, 252, 0.28)'

  // Fluted precision bezel ring (12 ticks for 9M Titanium, 24 watch-flute notches for 12M Sovereign)
  const ticks = isSovereign ? 24 : 12
  ctx.strokeStyle = ringColor
  ctx.lineWidth = isSovereign ? 1.25 : 1.05
  for (let t = 0; t < ticks; t++) {
    const ang = (t * Math.PI * 2) / ticks
    const r0 = isSovereign ? 36 : 35
    const r1 = isSovereign ? 42 : 40
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0)
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
    ctx.stroke()
  }

  ctx.strokeStyle = ringColor
  ctx.lineWidth = isSovereign ? 1.5 : 1.25
  ctx.beginPath()
  ctx.arc(cx, cy, 35, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.strokeStyle = innerRingColor
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3.5])
  ctx.beginPath()
  ctx.arc(cx, cy, 29, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = ringColor
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.arc(cx, cy, 23, 0, Math.PI * 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = design.accentPrimary
  ctx.font = `700 13px ${MONO_FONT}`
  ctx.fillText(isSovereign ? '12M' : '09M', cx, cy + 1)

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `600 7px ${MONO_FONT}`
  ctx.letterSpacing = '0.13em'
  ctx.fillText(isSovereign ? 'SOVEREIGN' : 'CEO VERIFIED', cx, cy + 12)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'

  ctx.restore()
}

export async function renderCertificateCard(
  stats: Stats,
  opts: CertificateOptions = {},
): Promise<HTMLCanvasElement> {
  const hideMoney = Boolean(opts.hideMoney)
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
  const cleanFirm = opts.firmName && opts.firmName !== 'Other' ? opts.firmName : ''
  const accountPrimary = cleanFirm || opts.accountName || 'Trading Account'
  const starting = stats.starting > 0 ? stats.starting : 0
  const returnPct = starting > 0 ? (stats.net / starting) * 100 : 0
  const totalR = stats.trades.reduce((acc, t) => acc + (Number(t.rMultiple) || 0), 0)
  const rangeText = formatRangeText(opts.rangeLabel)

  const issueText =
    opts.issueDate ||
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const certCode = makeCertId(
    `${traderName}|${accountPrimary}|${tierMonths}M|${stats.count}|${stats.net.toFixed(2)}`,
  )

  // 1. Deep Obsidian Canvas Backdrop & Tier Plate
  ctx.fillStyle = design.canvasBg
  ctx.fillRect(0, 0, W, H)

  const pad = 24
  const cardW = W - pad * 2
  const cardH = H - pad * 2

  ctx.save()
  roundRect(ctx, pad, pad, cardW, cardH, 18)
  const plateGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + cardH)
  plateGrad.addColorStop(0, design.cardBgTop)
  plateGrad.addColorStop(1, design.cardBgBottom)
  ctx.fillStyle = plateGrad
  ctx.shadowColor = TEXT_COLORS.shadow
  ctx.shadowBlur = 46
  ctx.shadowOffsetY = 14
  ctx.fill()
  ctx.restore()

  const stageDivX = 1068
  const candleCx = 1326
  const candleCy = 508 + design.candleCyOffset

  // Interior ambient studio wash, subtle corner dot texture & hairline framing clipped to plate
  ctx.save()
  roundRect(ctx, pad, pad, cardW, cardH, 18)
  ctx.clip()

  const leftWash = ctx.createRadialGradient(280, 210, 20, 280, 210, 680)
  leftWash.addColorStop(0, design.ambientWash)
  leftWash.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = leftWash
  ctx.fillRect(pad, pad, cardW, cardH)

  if (design.tier === 12) {
    const sovereignGoldWash = ctx.createRadialGradient(920, 110, 10, 920, 110, 560)
    sovereignGoldWash.addColorStop(0, 'rgba(230, 193, 122, 0.05)')
    sovereignGoldWash.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sovereignGoldWash
    ctx.fillRect(pad, pad, cardW, cardH)
  }

  drawDotMatrix(ctx, pad, pad, cardW, cardH, design.dotOpacity, candleCx, candleCy)

  const halfBeam = design.topBeamWidth / 2
  const topBeam = ctx.createLinearGradient(W / 2 - halfBeam, 0, W / 2 + halfBeam, 0)
  topBeam.addColorStop(0, 'rgba(255,255,255,0)')
  topBeam.addColorStop(0.5, design.topBeamColor)
  topBeam.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = topBeam
  ctx.fillRect(W / 2 - halfBeam, pad, design.topBeamWidth, 2)

  if (design.innerFrame) {
    roundRect(ctx, pad + 10, pad + 10, cardW - 20, cardH - 20, 12)
    ctx.strokeStyle = design.innerFrame
    ctx.lineWidth = 1
    ctx.stroke()
  }

  drawCornerAccents(ctx, pad, pad, cardW, cardH, design)

  ctx.restore()

  // Razor-sharp outer metallic perimeter border
  roundRect(ctx, pad, pad, cardW, cardH, 18)
  const frameGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + cardH)
  frameGrad.addColorStop(0, design.frameTop)
  frameGrad.addColorStop(0.5, design.frameMid)
  frameGrad.addColorStop(1, design.frameBottom)
  ctx.strokeStyle = frameGrad
  ctx.lineWidth = design.tier === 12 ? 1.5 : 1.25
  ctx.stroke()

  const innerX = 88
  const innerRight = W - 88
  const innerW = innerRight - innerX

  // 2. Top Header Strip
  const headerCenterY = 80
  if (logoImg && logoImg.naturalWidth > 0) {
    const crop = cropOpaqueLogoBounds(logoImg)
    const targetLogoH = 36
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
  ctx.font = `500 12px ${MONO_FONT}`
  ctx.fillText(
    `${certCode}   ·   ${design.headerTag}   ·   ${issueText.toUpperCase()}`,
    innerRight,
    headerCenterY + 4,
  )
  ctx.textAlign = 'left'

  const hRuleGrad = ctx.createLinearGradient(innerX, 0, innerRight, 0)
  hRuleGrad.addColorStop(0, design.frameMid)
  hRuleGrad.addColorStop(0.68, design.frameMid)
  hRuleGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hRuleGrad
  ctx.fillRect(innerX, 124, innerW, 1)

  // 3. Right-Side Luxury Candle Showcase Stage (Alpha-keyed crystal & dark titanium)
  drawCandleShowcaseStage(ctx, stageDivX, candleCx, candleCy, design, candleImg)

  // 4. Redesigned Left-Side Editorial Stack (Strictly inside x = 88 .. 1016)
  const leftZoneW = 928

  // Tier Kicker
  const kickerY = 182
  const barGrad = ctx.createLinearGradient(innerX, 0, innerX + 32, 0)
  barGrad.addColorStop(0, design.accentSecondary)
  barGrad.addColorStop(1, design.accentPrimary)
  ctx.fillStyle = barGrad
  ctx.fillRect(innerX, kickerY - 5, 32, 2.5)

  ctx.fillStyle = design.accentPrimary
  ctx.font = `600 12px ${MONO_FONT}`
  ctx.letterSpacing = '0.18em'
  ctx.fillText(design.kickerText, innerX + 46, kickerY)
  ctx.letterSpacing = '0px'

  // Headline
  const headline = 'Certificate of Performance'
  ctx.font = `600 44px ${DISPLAY_FONT}`
  ctx.letterSpacing = '-0.025em'
  const titleGrad = ctx.createLinearGradient(0, 204, 0, 256)
  titleGrad.addColorStop(0, '#f8fafc')
  titleGrad.addColorStop(1, '#94a3b8')
  ctx.fillStyle = titleGrad
  ctx.fillText(headline, innerX, 246)
  ctx.letterSpacing = '0px'

  // Recipient Eyebrow
  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `600 11px ${MONO_FONT}`
  ctx.letterSpacing = '0.2em'
  ctx.fillText('PRESENTED TO', innerX, 302)
  ctx.letterSpacing = '0px'

  // Monumental Trader Name
  const nameSize = fitFontSize(ctx, traderName, leftZoneW - 20, 76, 40, 800, DISPLAY_FONT)
  ctx.save()
  ctx.font = `800 ${nameSize}px ${DISPLAY_FONT}`
  ctx.letterSpacing = '-0.03em'
  const nameGrad = ctx.createLinearGradient(0, 324, 0, 396)
  nameGrad.addColorStop(0, design.nameTop)
  nameGrad.addColorStop(1, design.nameBottom)
  ctx.fillStyle = nameGrad
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  ctx.fillText(traderName, innerX, 384)
  ctx.restore()
  ctx.letterSpacing = '0px'

  // Diamond-node precision underline rule
  const nameRuleW = design.tier === 12 ? 340 : design.tier === 9 ? 300 : design.tier === 6 ? 270 : 240
  ctx.save()
  ctx.translate(innerX + 4, 410)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = design.accentPrimary
  ctx.fillRect(-3.5, -3.5, 7, 7)
  ctx.restore()

  const nameRuleGrad = ctx.createLinearGradient(innerX + 12, 0, innerX + nameRuleW, 0)
  nameRuleGrad.addColorStop(0, design.accentPrimary)
  nameRuleGrad.addColorStop(0.58, design.accentSecondary)
  nameRuleGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = nameRuleGrad
  ctx.fillRect(innerX + 14, 409, nameRuleW - 14, 2)

  // Citation Copy
  const sizeStr = starting > 0 ? formatMoney(starting, opts.currency) : ''
  const accountCore = cleanFirm
    ? [cleanFirm, sizeStr].filter(Boolean).join(' ')
    : opts.accountName || 'Trading Account'

  drawRichWrappedText(
    ctx,
    [
      {
        text: `Certifies ${tierMonths} consecutive months of verified profitable trading and disciplined risk execution on `,
      },
      { text: accountCore, bold: true },
      { text: '.' },
    ],
    innerX,
    452,
    840,
    28,
    `400 18.5px ${SANS_FONT}`,
    `600 18.5px ${SANS_FONT}`,
    TEXT_COLORS.text2,
    TEXT_COLORS.text,
  )

  // 5. Swiss Instrument 2x2 Fintech Telemetry Panel
  const gridX = innerX
  const gridY = 528
  const gridW = leftZoneW
  const gridH = 224
  const gridRadius = 14

  ctx.save()
  roundRect(ctx, gridX, gridY, gridW, gridH, gridRadius)
  const statsBgGrad = ctx.createLinearGradient(gridX, gridY, gridX + gridW, gridY + gridH)
  statsBgGrad.addColorStop(0, design.statsBgTop)
  statsBgGrad.addColorStop(1, design.statsBgBottom)
  ctx.fillStyle = statsBgGrad
  ctx.fill()

  // Subtle corner glass sheen inside panel
  ctx.clip()
  const glassSheen = ctx.createLinearGradient(gridX, gridY, gridX + 340, gridY + 140)
  glassSheen.addColorStop(0, 'rgba(255, 255, 255, 0.032)')
  glassSheen.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = glassSheen
  ctx.fillRect(gridX, gridY, gridW, gridH)
  ctx.restore()

  roundRect(ctx, gridX, gridY, gridW, gridH, gridRadius)
  const statsBorderGrad = ctx.createLinearGradient(gridX, gridY, gridX, gridY + gridH)
  statsBorderGrad.addColorStop(0, design.statsBorderTop)
  statsBorderGrad.addColorStop(1, design.statsBorderBottom)
  ctx.strokeStyle = statsBorderGrad
  ctx.lineWidth = design.tier === 12 ? 1.25 : 1
  ctx.stroke()

  const beamGrad = ctx.createLinearGradient(gridX + 28, 0, gridX + gridW - 28, 0)
  beamGrad.addColorStop(0, 'rgba(255,255,255,0)')
  beamGrad.addColorStop(0.5, design.statsBeam)
  beamGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = beamGrad
  ctx.fillRect(gridX + 28, gridY + 1, gridW - 56, 1)

  // Crosshair internal dividers
  const halfW = gridW / 2
  const halfH = gridH / 2
  const midX = gridX + halfW
  const midY = gridY + halfH

  const vDivGrad = ctx.createLinearGradient(0, gridY + 16, 0, gridY + gridH - 16)
  vDivGrad.addColorStop(0, 'rgba(255,255,255,0)')
  vDivGrad.addColorStop(0.5, design.dividerColor)
  vDivGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = vDivGrad
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(midX, gridY + 16)
  ctx.lineTo(midX, gridY + gridH - 16)
  ctx.stroke()

  const hDivGrad = ctx.createLinearGradient(gridX + 22, 0, gridX + gridW - 22, 0)
  hDivGrad.addColorStop(0, 'rgba(255,255,255,0)')
  hDivGrad.addColorStop(0.5, design.dividerColor)
  hDivGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = hDivGrad
  ctx.beginPath()
  ctx.moveTo(gridX + 22, midY)
  ctx.lineTo(gridX + gridW - 22, midY)
  ctx.stroke()

  // Center precision diamond node
  ctx.save()
  ctx.translate(midX, midY)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = design.accentPrimary
  ctx.fillRect(-2.5, -2.5, 5, 5)
  ctx.restore()

  const netVal = hideMoney
    ? starting > 0
      ? signedPercent(returnPct, 2)
      : `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`
    : signedUsd(stats.net)

  const netSub = hideMoney
    ? `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R net`
    : starting > 0
      ? `${signedPercent(returnPct, 2)} return`
      : `${stats.count} closed ${stats.count === 1 ? 'trade' : 'trades'}`

  const acctSub =
    [starting > 0 ? formatMoney(starting, opts.currency) : null, `${tierMonths}-Month Streak`]
      .filter(Boolean)
      .join('  ·  ') || `${tierMonths}-Month Streak`

  const cells = [
    {
      row: 0,
      col: 0,
      label: 'ACCOUNT',
      value: accountPrimary,
      sub: acctSub,
      color: TEXT_COLORS.text,
      barColor: design.accentPrimary,
    },
    {
      row: 0,
      col: 1,
      label: hideMoney ? 'NET RETURN' : 'NET PERFORMANCE',
      value: netVal,
      sub: netSub,
      color: stats.net >= 0 ? TEXT_COLORS.pos : TEXT_COLORS.neg,
      barColor: stats.net >= 0 ? TEXT_COLORS.pos : TEXT_COLORS.neg,
    },
    {
      row: 1,
      col: 0,
      label: 'WIN RATE',
      value: `${stats.winRate.toFixed(1)}%`,
      sub: `Profit Factor ${stats.pf >= 9.99 ? '∞' : stats.pf.toFixed(2)}`,
      color: TEXT_COLORS.text,
      barColor: null,
    },
    {
      row: 1,
      col: 1,
      label: 'EXECUTION',
      value: `${stats.count} ${stats.count === 1 ? 'Trade' : 'Trades'}`,
      sub: rangeText || `${stats.dayRows.length} Active ${stats.dayRows.length === 1 ? 'Day' : 'Days'}`,
      color: TEXT_COLORS.text,
      barColor: null,
    },
  ]

  cells.forEach((cell) => {
    const cx = gridX + cell.col * halfW + 32
    const cy = gridY + cell.row * halfH
    const maxValW = halfW - 60

    if (cell.barColor) {
      ctx.fillStyle = cell.barColor
      ctx.fillRect(cx, cy + 24, 14, 2)
    }

    const labelX = cell.barColor ? cx + 22 : cx
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `600 10.5px ${MONO_FONT}`
    ctx.letterSpacing = '0.16em'
    ctx.fillText(cell.label, labelX, cy + 29)
    ctx.letterSpacing = '0px'

    const valSize = fitFontSize(ctx, cell.value, maxValW, 31, 18, 700, DISPLAY_FONT)
    ctx.fillStyle = cell.color
    ctx.font = `700 ${valSize}px ${DISPLAY_FONT}`
    ctx.fillText(cell.value, cx, cy + 68)

    const subSize = fitFontSize(ctx, cell.sub, maxValW, 13, 10.5, 500, SANS_FONT)
    ctx.fillStyle = TEXT_COLORS.muted
    ctx.font = `500 ${subSize}px ${SANS_FONT}`
    ctx.fillText(cell.sub, cx, cy + 93)
  })

  // 6. Bottom CEO Signature Block + Tier Verification Seal
  const sigX = innerX
  const sigY = 796
  drawCeoSignature(ctx, sigX + 2, sigY, TEXT_COLORS.text, design.accentPrimary)

  const sigRuleGrad = ctx.createLinearGradient(sigX, 0, sigX + 300, 0)
  sigRuleGrad.addColorStop(0, design.accentPrimary)
  sigRuleGrad.addColorStop(0.7, design.frameMid)
  sigRuleGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sigRuleGrad
  ctx.fillRect(sigX, sigY + 48, 300, 1.25)

  ctx.fillStyle = TEXT_COLORS.text
  ctx.font = `600 11.5px ${MONO_FONT}`
  ctx.letterSpacing = '0.18em'
  ctx.fillText('CHIEF EXECUTIVE OFFICER', sigX, sigY + 72)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = TEXT_COLORS.muted
  ctx.font = `500 12.5px ${SANS_FONT}`
  ctx.fillText(
    `Traders Area  ·  ${design.editionSub}  ·  ${issueText}`,
    sigX,
    sigY + 95,
  )

  drawExecutiveSeal(ctx, gridX + gridW - 44, sigY + 52, design)

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
        text: 'Traders Area — Verified Performance Certificate',
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
