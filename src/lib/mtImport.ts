import type { Side } from '@/lib/types'

export interface ImportedTrade {
  ticket: string
  symbol: string
  side: Side
  volume: number
  entry: number
  exit: number
  stopLoss: number
  takeProfit: number
  pnl: number
  fees: number
  date: string
  openTime: string
  closeTime: string
}

export interface HistoryImportMeta {
  /** Account holder / challenge name printed on the statement, e.g. "02-EZE FUNDED 2 STEP PRO (PHASE 1)". */
  accountName: string
  /** Login number printed on the statement, e.g. "474890255". */
  accountNumber: string
  company: string
  generatedAt: string
}

export interface HistoryImportResult {
  platform: 'MT4' | 'MT5' | 'Unknown'
  format: 'HTML' | 'CSV' | 'XLSX'
  trades: ImportedTrade[]
  skipped: number
  totalPnl: number
  from: string
  to: string
  meta: HistoryImportMeta
}

interface HeaderMap {
  ticket?: number
  openTime?: number
  closeTime?: number
  symbol?: number
  type?: number
  volume?: number
  entry?: number
  exit?: number
  stopLoss?: number
  takeProfit?: number
  profit?: number
  net?: number
  commission?: number
  swap?: number
  tax?: number
  /** Table shape flags, used to tell closed positions apart from orders/deals. */
  hasPosition?: boolean
  hasDirection?: boolean
  hasDeal?: boolean
}

interface ParsedTable {
  trades: ImportedTrade[]
  skipped: number
  header: HeaderMap
  meta: HistoryImportMeta
}

const EMPTY_META: HistoryImportMeta = {
  accountName: '',
  accountNumber: '',
  company: '',
  generatedAt: '',
}

interface DateParts {
  date: string
  time: string
}

const BUY_TYPES = /^(buy|long)\b/i
const SELL_TYPES = /^(sell|short)\b/i
const SECTION_BREAK =
  /^(positions?|open positions?|orders?|pending orders?|working orders?|deals?|results?|balance|closed (transactions?|trades?))$/i

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function cellText(value: string | undefined): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value: string | undefined): number {
  let text = cellText(value)
  if (!text) return Number.NaN
  text = text.replace(/[^\d,.\-+]/g, '')
  if (!text) return Number.NaN
  const negative = text.startsWith('-')
  text = text.replace(/[+-]/g, '')
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/,/g, '')
  } else if (text.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, '')
    } else {
      text = text.replace(',', '.')
    }
  }
  const parsed = Number.parseFloat(text)
  if (!Number.isFinite(parsed)) return Number.NaN
  return negative ? -parsed : parsed
}

function parseSide(value: string | undefined): Side | null {
  const text = cellText(value)
  if (!text) return null
  if (BUY_TYPES.test(text)) return 'LONG'
  if (SELL_TYPES.test(text)) return 'SHORT'
  return null
}

function buildHeaderMap(cells: string[]): HeaderMap | null {
  const map: HeaderMap = {}
  let timeCount = 0
  let priceCount = 0
  let singleTime: number | null = null

  const normalized = cells.map(normalizeHeader)
  map.hasPosition = normalized.some((h) => h === 'position')
  map.hasDirection = normalized.some((h) => h === 'direction')
  map.hasDeal = normalized.some((h) => h === 'deal')

  cells.forEach((cell, index) => {
    const h = normalizeHeader(cell)
    if (!h) return

    if (map.ticket === undefined && (h.includes('ticket') || h === 'position' || h === 'deal' || h === 'order' || h === 'id')) {
      map.ticket = index
      return
    }
    if (map.symbol === undefined && (h === 'symbol' || h === 'item' || h === 'instrument' || h === 'market')) {
      map.symbol = index
      return
    }
    if (map.type === undefined && (h === 'type' || h === 'side' || h === 'action')) {
      map.type = index
      return
    }
    if (map.volume === undefined && (h.includes('volume') || h === 'size' || h === 'lots' || h === 'lot' || h.includes('quantity') || h === 'qty')) {
      map.volume = index
      return
    }
    if (map.openTime === undefined && (h.includes('opentime') || h === 'open' || h === 'timeopen' || h.includes('entrytime'))) {
      map.openTime = index
      return
    }
    if (map.closeTime === undefined && (h.includes('closetime') || h === 'close' || h === 'timeclose' || h.includes('exittime'))) {
      map.closeTime = index
      return
    }
    if (map.entry === undefined && (h === 'openprice' || h === 'entryprice' || h.includes('priceopen') || h.includes('priceentry'))) {
      map.entry = index
      return
    }
    if (map.exit === undefined && (h === 'closeprice' || h === 'exitprice' || h.includes('priceclose') || h.includes('priceexit'))) {
      map.exit = index
      return
    }
    if (map.stopLoss === undefined && (h === 'sl' || h === 'stoploss' || h.includes('stoploss') || h.includes('stoplvl'))) {
      map.stopLoss = index
      return
    }
    if (map.takeProfit === undefined && (h === 'tp' || h === 'takeprofit' || h.includes('takeprofit') || h.includes('targetprice'))) {
      map.takeProfit = index
      return
    }
    if (map.net === undefined && (h === 'net' || h.includes('netprofit') || h.includes('netpl') || h.includes('netpnl'))) {
      map.net = index
      return
    }
    if (map.profit === undefined && (h.includes('profit') || h === 'pnl' || h === 'pl' || h === 'grosspl' || h === 'grosspnl')) {
      map.profit = index
      return
    }
    if (map.commission === undefined && (h.includes('commission') || h === 'comm' || h === 'fee' || h === 'fees')) {
      map.commission = index
      return
    }
    if (map.swap === undefined && h.includes('swap')) {
      map.swap = index
      return
    }
    if (map.tax === undefined && h.includes('tax')) {
      map.tax = index
      return
    }
    if (h === 'time' || h.startsWith('time')) {
      timeCount += 1
      if (timeCount === 1 && map.openTime === undefined) {
        map.openTime = index
        singleTime = index
      } else if (timeCount === 2 && map.closeTime === undefined) {
        map.closeTime = index
        singleTime = null
      }
      return
    }
    if (h === 'price' || h === 'pricecurrency') {
      priceCount += 1
      if (priceCount === 1 && map.entry === undefined) map.entry = index
      else if (priceCount === 2 && map.exit === undefined) map.exit = index
    }
  })

  // A lone "Time" column in a MetaTrader report is the position close time.
  if (singleTime !== null && map.closeTime === undefined) {
    map.closeTime = singleTime
    if (map.openTime === singleTime) map.openTime = undefined
  }

  if (map.symbol === undefined || map.type === undefined) return null
  if (map.profit === undefined && map.net === undefined) return null
  return map
}

function parseDate(value: string | undefined): DateParts | null {
  const text = cellText(value)
  if (!text) return null

  let year = 0
  let month = 0
  let day = 0

  const iso = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else {
    const other = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/)
    if (!other) return null
    const first = Number(other[1])
    const second = Number(other[2])
    let third = Number(other[3])
    if (third < 100) third += third >= 70 ? 1900 : 2000
    const dayFirst = first > 12 || (first <= 12 && second <= 12 && text.includes('.'))
    year = third
    month = dayFirst ? second : first
    day = dayFirst ? first : second
  }

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  let time = ''
  if (timeMatch) {
    const hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])
    const seconds = Number(timeMatch[3] ?? 0)
    if (hours < 24 && minutes < 60 && seconds < 60) {
      time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
  }

  return { date, time }
}

function tradeFromRow(cells: string[], map: HeaderMap): ImportedTrade | null {
  const value = (index: number | undefined) => (index === undefined ? '' : cellText(cells[index]))
  const side = parseSide(value(map.type))
  if (!side) return null

  const symbol = value(map.symbol).toUpperCase().replace(/\s+/g, '')
  if (!symbol) return null

  const grossProfit = map.net === undefined ? parseNumber(value(map.profit)) : Number.NaN
  const netProfit = map.net === undefined ? Number.NaN : parseNumber(value(map.net))
  if (!Number.isFinite(grossProfit) && !Number.isFinite(netProfit)) return null

  const commission = map.commission === undefined ? 0 : parseNumber(value(map.commission)) || 0
  const swap = map.swap === undefined ? 0 : parseNumber(value(map.swap)) || 0
  const tax = map.tax === undefined ? 0 : parseNumber(value(map.tax)) || 0
  const fees = Math.abs(commission) + Math.abs(swap) + Math.abs(tax)
  const pnl = Number.isFinite(netProfit)
    ? netProfit
    : grossProfit + commission + swap + tax

  const open = parseDate(value(map.openTime))
  const close = parseDate(value(map.closeTime))
  if (!open && !close) return null

  const stopLoss = map.stopLoss === undefined ? Number.NaN : parseNumber(value(map.stopLoss))
  const takeProfit = map.takeProfit === undefined ? Number.NaN : parseNumber(value(map.takeProfit))

  return {
    ticket: value(map.ticket).replace(/\s+/g, ''),
    symbol,
    side,
    volume: map.volume === undefined ? 0 : Math.abs(parseNumber(value(map.volume)) || 0),
    entry: map.entry === undefined ? 0 : parseNumber(value(map.entry)) || 0,
    exit: map.exit === undefined ? 0 : parseNumber(value(map.exit)) || 0,
    stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? round(stopLoss, 5) : 0,
    takeProfit: Number.isFinite(takeProfit) && takeProfit > 0 ? round(takeProfit, 5) : 0,
    pnl: round(pnl),
    fees: round(fees),
    date: close?.date || open?.date || '',
    openTime: open?.time || '',
    closeTime: close?.time || '',
  }
}

function parseRows(rows: string[][], headerIndex: number, map: HeaderMap): ParsedTable {
  const trades: ImportedTrade[] = []
  let skipped = 0

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index]
    if (!cells || cells.every((cell) => !cellText(cell))) continue

    // A sheet import (XLSX) keeps every section in one grid. Stop at the next
    // section heading so "Orders"/"Deals" rows are not read as closed trades.
    const filled = cells.filter((cell) => cellText(cell))
    if (filled.length === 1 && SECTION_BREAK.test(cellText(filled[0]))) break

    const type = map.type === undefined ? '' : cellText(cells[map.type])
    if (!parseSide(type)) {
      if (/buy|sell|long|short/i.test(type)) skipped += 1
      continue
    }

    const trade = tradeFromRow(cells, map)
    if (!trade) {
      skipped += 1
      continue
    }
    trades.push(trade)
  }

  return { trades, skipped, header: map, meta: EMPTY_META }
}

/** Read the "Name / Account / Company / Date" header that MetaTrader prints above the tables. */
function extractMeta(rows: string[][]): HistoryImportMeta {
  const findValue = (label: RegExp): string => {
    for (const row of rows) {
      for (let index = 0; index < row.length; index += 1) {
        const text = cellText(row[index])
        if (!label.test(text)) continue

        const inline = text.replace(label, '').replace(/^:\s*/, '').trim()
        if (inline) return inline
        for (let next = index + 1; next < row.length; next += 1) {
          const value = cellText(row[next])
          if (value) return value
        }
      }
    }
    return ''
  }

  const account = findValue(/^account\s*:?\s*/i)
  const number = account.match(/\b(\d{5,})\b/)?.[1] ?? ''

  return {
    accountName: findValue(/^name\s*:?\s*/i),
    accountNumber: number,
    company: findValue(/^company\s*:?\s*/i),
    generatedAt: findValue(/^date\s*:?\s*/i),
  }
}

/**
 * Prefer closed-position tables. MetaTrader 5 sheets also contain "Orders" and
 * "Deals" tables; the deals table repeats every entry/exit and must not win.
 */
function scoreTable(parsed: ParsedTable): number {
  const map = parsed.header
  let score = parsed.trades.length * 10
  if (map.closeTime !== undefined) score += 2_500
  if (map.hasPosition) score += 4_000
  if (map.hasDeal && !map.hasPosition) score -= 1_000
  if (map.hasDirection) score -= 5_000
  if (map.ticket !== undefined) score += 100
  return score
}

function resultFromParsed(
  parsed: ParsedTable | null,
  format: HistoryImportResult['format'],
  platform: HistoryImportResult['platform'],
): HistoryImportResult {
  if (!parsed || !parsed.trades.length) {
    return {
      platform,
      format,
      trades: [],
      skipped: parsed?.skipped ?? 0,
      totalPnl: 0,
      from: '',
      to: '',
      meta: parsed?.meta ?? EMPTY_META,
    }
  }

  const trades = [...parsed.trades].sort((a, b) =>
    (a.date + a.closeTime).localeCompare(b.date + b.closeTime),
  )
  const dates = trades.map((trade) => trade.date).filter(Boolean).sort()

  return {
    platform,
    format,
    trades,
    skipped: parsed.skipped,
    totalPnl: round(trades.reduce((total, trade) => total + trade.pnl, 0)),
    from: dates[0] ?? '',
    to: dates[dates.length - 1] ?? '',
    meta: parsed.meta,
  }
}

function bestTable(rows: string[][]): ParsedTable | null {
  let best: ParsedTable | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  rows.forEach((row, headerIndex) => {
    const map = buildHeaderMap(row)
    if (!map) return
    const parsed = parseRows(rows, headerIndex, map)
    if (!parsed.trades.length) return
    const score = scoreTable(parsed)
    if (score > bestScore) {
      best = parsed
      bestScore = score
    }
  })

  if (best) {
    const found: ParsedTable = best
    found.meta = extractMeta(rows)
  }
  return best
}

/**
 * Parse a spreadsheet grid (used for .xlsx reports). The MetaTrader report
 * prints its header details and every table on a single sheet.
 */
export function parseMetaTraderRows(
  rows: string[][],
  platformHint = '',
): HistoryImportResult {
  const platform = detectMetaTraderPlatform(platformHint || rows.map((row) => row.join(' ')).join('\n'))
  return resultFromParsed(bestTable(rows), 'XLSX', platform)
}

function parseHtml(text: string): ParsedTable | null {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  const tables = Array.from(doc.querySelectorAll('table'))
  const allRows: string[][] = []
  let best: ParsedTable | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  tables.forEach((table) => {
    const trs = Array.from(table.querySelectorAll('tr'))
    const rows = trs.map((tr) =>
      Array.from(tr.querySelectorAll('th, td')).map((cell) => cellText(cell.textContent)),
    )
    allRows.push(...rows)
    if (rows.length < 2) return

    rows.forEach((row, headerIndex) => {
      const map = buildHeaderMap(row)
      if (!map) return
      const parsed = parseRows(rows, headerIndex, map)
      if (!parsed.trades.length) return
      const score = scoreTable(parsed)
      if (score > bestScore) {
        best = parsed
        bestScore = score
      }
    })
  })

  if (best) {
    const found: ParsedTable = best
    found.meta = extractMeta(allRows)
  }
  return best
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 30).join('\n')
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = -1
  candidates.forEach((delimiter) => {
    const count = sample.split(delimiter).length
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  })
  return best
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(cellText(cell))
      cell = ''
    } else if (char === '\n') {
      row.push(cellText(cell))
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cellText(cell))
    rows.push(row)
  }

  return rows
}

function parseCsv(text: string): ParsedTable | null {
  const rows = parseDelimited(text, detectDelimiter(text))
  return bestTable(rows)
}

export function detectMetaTraderPlatform(text: string): 'MT4' | 'MT5' | 'Unknown' {
  if (/metatrader\s*5/i.test(text) || /mt5/i.test(text)) return 'MT5'
  if (/metatrader\s*4/i.test(text) || /mt4/i.test(text)) return 'MT4'
  return 'Unknown'
}

export function parseMetaTraderHistory(text: string): HistoryImportResult {
  const source = text.trim()
  const isHtml = /<table|<html|<!doctype html|<td/i.test(source.slice(0, 4000))
  const parsed = isHtml ? parseHtml(source) : parseCsv(source)
  const format = isHtml ? 'HTML' : 'CSV'
  const platform = detectMetaTraderPlatform(source)
  return resultFromParsed(parsed, format, platform)
}
