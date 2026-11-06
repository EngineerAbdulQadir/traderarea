import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/AQI/AppData/Local/Temp/ta-qa/print'
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
await wait(1500)
await page.goto('http://localhost:4173/#/reports', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.reports-page', { timeout: 5000 })
await wait(900)

await page.emulateMediaType('print')
await wait(500)
const state = await page.evaluate(() => {
  const style = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      display: cs.display,
      background: cs.backgroundColor,
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  }
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    sidebar: style('.sidebar'),
    topbar: style('.topbar'),
    pageActions: style('.reports-page .page-actions'),
    title: style('.page-title'),
    scope: style('.report-scope'),
    docWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    printMedia: matchMedia('print').matches,
  }
})
console.log('PRINT STATE', JSON.stringify(state, null, 2))
await page.screenshot({ path: path.join(OUT, 'reports-print.png'), fullPage: true })
await page.pdf({ path: path.join(OUT, 'reports-print.pdf'), format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' } })
await page.emulateMediaType('screen')

fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2))
console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
