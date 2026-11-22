import { getMarketCandles } from '../../lib/marketCandles.ts'

interface VercelRequestLike {
  method?: string
  url?: string
  query?: Record<string, string | string[] | undefined>
}

interface VercelResponseLike {
  setHeader: (name: string, value: string) => void
  status: (code: number) => VercelResponseLike
  json: (body: unknown) => void
}

function readQueryParam(
  req: VercelRequestLike,
  searchParams: URLSearchParams | null,
  key: string,
): string {
  const fromQuery = req.query?.[key]
  if (typeof fromQuery === 'string') return fromQuery.trim()
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0].trim()
  return (searchParams?.get(key) ?? '').trim()
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  const searchParams = req.url ? new URL(req.url, 'http://localhost').searchParams : null
  const symbol = readQueryParam(req, searchParams, 'symbol')
  const interval = readQueryParam(req, searchParams, 'interval') || '5m'
  const date = readQueryParam(req, searchParams, 'date')
  const openTime = readQueryParam(req, searchParams, 'openTime')
  const closeTime = readQueryParam(req, searchParams, 'closeTime')
  const entryRaw = Number(readQueryParam(req, searchParams, 'entry'))
  const exitRaw = Number(readQueryParam(req, searchParams, 'exit'))

  if (!symbol) {
    res.status(400).json({ ok: false, error: 'Symbol is required.' })
    return
  }

  const result = await getMarketCandles({
    symbol,
    interval,
    date,
    openTime,
    closeTime,
    entry: Number.isFinite(entryRaw) && entryRaw > 0 ? entryRaw : undefined,
    exit: Number.isFinite(exitRaw) && exitRaw > 0 ? exitRaw : undefined,
  })

  if (!result) {
    res.status(404).json({
      ok: false,
      error: `No real market candles available for ${symbol}.`,
    })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  res.status(200).json(result)
}
