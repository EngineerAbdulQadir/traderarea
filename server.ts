import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import { getMarketCandles, type MarketCandle } from './lib/marketCandles.ts'

export type { MarketCandle }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000
const IS_PROD = process.env.NODE_ENV === 'production'

async function createApp() {
  const app = express()

  app.get('/api/market/candles', async (req: Request, res: Response) => {
    const symbol = String(req.query.symbol ?? '').trim()
    const interval = String(req.query.interval ?? '5m').trim()
    const date = String(req.query.date ?? '').trim()
    const openTime = String(req.query.openTime ?? '').trim()
    const closeTime = String(req.query.closeTime ?? '').trim()

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
    })

    if (!result) {
      res.status(404).json({
        ok: false,
        error: `No real market candles available for ${symbol}.`,
      })
      return
    }

    res.json(result)
  })

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({ ok: false, error: 'API endpoint not found.' })
        return
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html')
        const rawHtml = fs.readFileSync(indexPath, 'utf-8')
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (err) {
        vite.ssrFixStacktrace(err as Error)
        next(err)
      }
    })
  } else {
    const distDir = path.resolve(__dirname, 'dist')
    app.use(express.static(distDir))
    app.use((req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({ ok: false, error: 'API endpoint not found.' })
        return
      }
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}

createApp().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
