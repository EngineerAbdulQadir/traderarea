import type { Stats } from '@/lib/types'
import { formatUsd2 } from '@/lib/format'

export interface ShareCardOptions {
  accountName?: string
  rangeLabel?: string
  watermark?: string
  logoUrl?: string
}

const W = 1080
const H = 1080

const C = {
  bg: '#0f1113',
  panel: '#191c1f',
  panel2: '#141618',
  border: 'rgba(255,255,255,0.08)',
  text: '#f6f9ff',
  text2: '#d9dde5',
  muted: '#a4aab5',
  faint: '#8f96a1',
  accent: '#a0bff2',
  pos: '#4ebe7d',
  neg: '#f27166',
}

function money(n: number): string {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 20) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = C.panel
  ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.stroke()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20) {
  ctx.fillStyle = C.muted
  ctx.font = `600 ${size}px "InterVariable", Inter, system-ui, sans-serif`
  ctx.letterSpacing = '0.12em'
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

function value(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 40, color = C.text, weight = 700) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px "InterVariable", Inter, system-ui, sans-serif`
  ctx.fillText(text, x, y)
}

export async function renderShareCard(stats: Stats, opts: ShareCardOptions = {}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const accountName = opts.accountName || 'Trader'
  const rangeLabel = opts.rangeLabel || 'Performance'
  const watermark = opts.watermark || 'Trader Area — free trading journal'
  const logoUrl = opts.logoUrl || '/logo.png'

  // Load logo (best effort, with timeout)
  let logo: HTMLImageElement | null = null
  try {
    logo = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      let done = false
      const finish = (v: HTMLImageElement | null) => { if (!done) { done = true; resolve(v) } }
      img.onload = () => finish(img)
      img.onerror = () => finish(null)
      setTimeout(() => finish(null), 1200)
      img.src = logoUrl
    })
  } catch {
    logo = null
  }

  // Background
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  // Subtle top accent line
  const grad = ctx.createLinearGradient(72, 0, W - 72, 0)
  grad.addColorStop(0, 'rgba(160,191,242,0)')
  grad.addColorStop(0.5, 'rgba(160,191,242,0.6)')
  grad.addColorStop(1, 'rgba(160,191,242,0)')
  ctx.fillStyle = grad
  ctx.fillRect(72, 0, W - 144, 2)

  // Header row: logo mark + brand
  // Logo image (best effort)
  try {
    const img = new Image()
    img.src = logoUrl
    // synchronous draw not possible; skip if not cached — text fallback used
  } catch {
    /* noop */
  }

  // Logo + brand wordmark
  const logoSize = 52
  if (logo) {
    // rounded clip
    ctx.save()
    roundRect(ctx, 72, 40, logoSize, logoSize, 12)
    ctx.clip()
    ctx.drawImage(logo, 72, 40, logoSize, logoSize)
    ctx.restore()
  } else {
    // fallback mark
    roundRect(ctx, 72, 40, logoSize, logoSize, 12)
    ctx.fillStyle = C.accent
    ctx.fill()
    ctx.fillStyle = C.bg
    ctx.font = '800 26px "InterVariable", Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('T', 72 + logoSize / 2, 40 + logoSize / 2 + 9)
    ctx.textAlign = 'left'
  }
  ctx.fillStyle = C.text
  ctx.font = '700 30px "InterVariable", Inter, system-ui, sans-serif'
  ctx.fillText('Trader Area', 72 + logoSize + 16, 74)
  ctx.fillStyle = C.muted
  ctx.font = '500 20px "InterVariable", Inter, system-ui, sans-serif'
  ctx.fillText('Performance card', 72 + logoSize + 16, 102)

  // Account + range (right aligned)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.text
  ctx.font = '600 26px "InterVariable", Inter, system-ui, sans-serif'
  ctx.fillText(accountName, W - 72, 86)
  ctx.fillStyle = C.muted
  ctx.font = '500 20px "InterVariable", Inter, system-ui, sans-serif'
  ctx.fillText(rangeLabel, W - 72, 118)
  ctx.textAlign = 'left'

  // Hero net PnL panel
  panel(ctx, 72, 160, W - 144, 230, 24)
  label(ctx, 'Net P&L', 104, 206, 20)
  const netColor = stats.net >= 0 ? C.pos : C.neg
  value(ctx, money(stats.net), 104, 300, 96, netColor, 800)
  // sub stats under hero
  const subY = 356
  const subs = [
    { l: 'Win rate', v: `${stats.winRate.toFixed(1)}%`, c: stats.winRate >= 50 ? C.pos : C.neg },
    { l: 'Profit factor', v: stats.pf >= 9.99 ? '∞' : stats.pf.toFixed(2), c: stats.pf >= 1.5 ? C.pos : C.muted },
    { l: 'Trades', v: String(stats.count), c: C.text },
  ]
  let sx = 104
  subs.forEach((s, i) => {
    if (i > 0) {
      ctx.strokeStyle = C.border
      ctx.beginPath()
      ctx.moveTo(sx - 24, subY - 26)
      ctx.lineTo(sx - 24, subY + 6)
      ctx.stroke()
    }
    label(ctx, s.l, sx, subY - 8, 16)
    value(ctx, s.v, sx, subY + 26, 30, s.c, 700)
    sx += 260
  })

  // KPI grid 2x2
  const kpis: { label: string; value: string; color?: string }[] = [
    { label: 'Wins / Losses', value: `${stats.wins} / ${stats.losses}` },
    { label: 'Avg win', value: formatUsd2(stats.avgWin), color: C.pos },
    { label: 'Avg loss', value: formatUsd2(stats.avgLoss), color: C.neg },
    { label: 'Max drawdown', value: money(-stats.maxDrawdown), color: C.neg },
    { label: 'Best day', value: stats.bestDay ? money(stats.bestDay.pnl) : '—', color: C.pos },
    { label: 'Worst day', value: stats.worstDay ? money(stats.worstDay.pnl) : '—', color: C.neg },
  ]
  const gridX = 72
  const gridY = 420
  const cols = 3
  const gap = 16
  const cardW = (W - 144 - gap * (cols - 1)) / cols
  const cardH = 150
  const rows = 2
  kpis.forEach((k, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = gridX + col * (cardW + gap)
    const y = gridY + row * (cardH + gap)
    panel(ctx, x, y, cardW, cardH, 18)
    label(ctx, k.label, x + 22, y + 46, 16)
    value(ctx, k.value, x + 22, y + 104, 32, k.color || C.text, 700)
  })

  // Win/loss bar
  const barY = gridY + rows * (cardH + gap) + 10
  panel(ctx, 72, barY, W - 144, 90, 18)
  label(ctx, 'Win / loss split', 104, barY + 38, 16)
  const total = Math.max(1, stats.wins + stats.losses + stats.be)
  const winW = ((stats.wins / total) * (W - 144 - 44)) 
  // track
  roundRect(ctx, 104, barY + 52, W - 144 - 32, 14, 7)
  ctx.fillStyle = C.panel2
  ctx.fill()
  // win fill
  roundRect(ctx, 104, barY + 52, Math.max(8, winW), 14, 7)
  ctx.fillStyle = C.pos
  ctx.fill()
  // loss fill
  const lossW = (stats.losses / total) * (W - 144 - 32)
  roundRect(ctx, 104 + (W - 144 - 32) - Math.max(0, lossW), barY + 52, Math.max(0, lossW), 14, 7)
  ctx.fillStyle = C.neg
  ctx.fill()
  ctx.fillStyle = C.muted
  ctx.font = '500 18px "InterVariable", Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${stats.wins}W · ${stats.losses}L · ${stats.be}BE`, W - 104, barY + 40)
  ctx.textAlign = 'left'

  // Footer
  const footerY = H - 70
  ctx.fillStyle = C.muted
  ctx.font = '500 20px "InterVariable", Inter, system-ui, sans-serif'
  ctx.fillText(watermark, 72, footerY)
  // free badge (right)
  const badgeText = 'FREE JOURNAL'
  ctx.font = '700 18px "InterVariable", Inter, system-ui, sans-serif'
  const bw = ctx.measureText(badgeText).width + 28
  const bx = W - 72 - bw
  roundRect(ctx, bx, footerY - 26, bw, 34, 17)
  ctx.fillStyle = 'rgba(78,190,125,0.14)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(78,190,125,0.45)'
  ctx.stroke()
  ctx.fillStyle = C.pos
  ctx.fillText(badgeText, bx + 14, footerY - 4)

  return canvas
}

export async function shareCard(stats: Stats, opts: ShareCardOptions = {}): Promise<void> {
  const canvas = await renderShareCard(stats, opts)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to render card')
  const file = new File([blob], 'trader-area-stats.png', { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'My trading performance', text: opts.watermark || 'Trader Area — free trading journal' })
      return
    } catch {
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'trader-area-stats.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function cardDataUrl(stats: Stats, opts: ShareCardOptions = {}): Promise<string> {
  const canvas = await renderShareCard(stats, opts)
  return canvas.toDataURL('image/png')
}
