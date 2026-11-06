import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/AQI/AppData/Local/Temp/ta-qa/responsive'
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--force-device-scale-factor=1', '--font-render-hinting=none'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'domcontentloaded' })
await wait(1000)
await page.$$eval('button', (nodes) => nodes.find((node) => node.textContent?.includes('Load demo workspace'))?.click())
await wait(1400)

const routes = [
  ['/', 'dashboard'],
  ['/accounts', 'accounts'],
  ['/stats', 'stats'],
  ['/entries', 'entries'],
  ['/notes', 'notes'],
  ['/reports', 'reports'],
]

for (const width of [390, 360, 320]) {
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1 })
  for (const [route, name] of routes) {
    await page.goto(`http://localhost:4173/#${route}`, { waitUntil: 'domcontentloaded' })
    await wait(1700)
    const report = await page.evaluate(() => {
      const rect = (el) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      }
      const gridColumns = (selector) => {
        const el = document.querySelector(selector)
        return el ? getComputedStyle(el).gridTemplateColumns : null
      }
      const overflowing = []
      for (const el of document.querySelectorAll('.page *')) {
        if (el.closest('.calendar-card')) continue
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
          const s = getComputedStyle(el)
          if (s.overflowX === 'hidden' || s.textOverflow === 'ellipsis') continue
          overflowing.push({
            tag: el.tagName,
            cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
            sw: el.scrollWidth,
            cw: el.clientWidth,
          })
        }
      }
      const actionRects = Array.from(document.querySelectorAll('.reports-page .page-actions > *')).map((el) => ({
        tag: el.tagName,
        cls: typeof el.className === 'string' ? el.className : '',
        text: el.textContent?.trim().slice(0, 40),
        ...rect(el),
      }))
      const summaryTexts = Array.from(document.querySelectorAll('.accounts-page .summary-tile > b')).map((el) => ({
        text: el.textContent,
        ...rect(el),
        clipped: el.scrollWidth > el.clientWidth + 1,
      }))
      return {
        hash: location.hash,
        pageText: (document.querySelector('.page')?.innerText || '').trim().slice(0, 40),
        docWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        overflowing: overflowing.slice(0, 8),
        statsKpis: gridColumns('.stats-kpis'),
        notesKpis: gridColumns('.notes-kpis'),
        accountsSummary: gridColumns('.accounts-summary'),
        actionRects,
        summaryTexts,
      }
    })
    if (!report.pageText) errors.push(`blank ${name} at ${width}`)
    if (report.overflowX) errors.push(`overflow ${name} at ${width}: ${report.docWidth}/${report.viewport}`)
    console.log(`${width} ${name}`, JSON.stringify(report))
    if (['accounts', 'stats', 'notes', 'reports'].includes(name)) {
      await page.screenshot({ path: path.join(OUT, `${width}-${name}.png`), fullPage: true })
    }
  }
}

// Capture the reports header at narrow widths without a full-page image.
for (const width of [390, 360, 320]) {
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1 })
  await page.goto('http://localhost:4173/#/reports', { waitUntil: 'domcontentloaded' })
  await wait(1600)
  await page.screenshot({ path: path.join(OUT, `${width}-reports-header.png`), clip: { x: 0, y: 0, width, height: 480 } })
}

fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2))
console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
