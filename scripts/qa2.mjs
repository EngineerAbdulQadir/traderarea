import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/AQI/AppData/Local/Temp/ta-qa'
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
await wait(500)
await page.$$eval('button', (nodes) => nodes.find((node) => node.textContent?.includes('Load demo workspace'))?.click())
await page.waitForSelector('.hero-card', { timeout: 5000 })
await wait(1000)
await page.screenshot({ path: `${OUT}/20-dashboard-calendar-fallback.png`, fullPage: true })
await page.evaluate(() => window.scrollTo(0, 1040))
await wait(300)
await page.screenshot({ path: `${OUT}/21-calendar-october.png`, fullPage: false })

await page.evaluate(() => window.scrollTo(0, 0))
await page.keyboard.down('Control')
await page.keyboard.press('KeyK')
await page.keyboard.up('Control')
await wait(600)
await page.screenshot({ path: `${OUT}/22-command-palette.png`, fullPage: false })
await page.keyboard.press('Escape')
await wait(500)

// Day review from a day with trades in the fallback month
await page.evaluate(() => window.scrollTo(0, 1040))
await wait(300)
const day = await page.$('.calendar-day.is-win:not(:disabled)')
if (!day) throw new Error('No trade day available')
await day.click()
await page.waitForSelector('.day-modal', { timeout: 5000 })
await wait(700)
await page.screenshot({ path: `${OUT}/23-day-review.png`, fullPage: false })
await page.keyboard.press('Escape')
await wait(400)

// Trade modal form metrics
await page.evaluate(() => window.scrollTo(0, 0))
await page.$$eval('button', (nodes) => nodes.find((node) => node.textContent?.trim().includes('Log trade'))?.click())
await page.waitForSelector('.trade-form', { timeout: 5000 })
await wait(500)
const modalMetrics = await page.evaluate(() => {
  const panel = document.querySelector('.modal-panel')
  const form = document.querySelector('.trade-form')
  const body = document.querySelector('.trade-body')
  const foot = document.querySelector('.modal-foot')
  const note = document.querySelector('#trade-note')
  const rect = (el) => (el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), height: Math.round(el.getBoundingClientRect().height) } : null)
  return {
    panel: rect(panel),
    panelScrollHeight: panel?.scrollHeight,
    form: rect(form),
    body: rect(body),
    foot: rect(foot),
    note: rect(note),
    viewport: window.innerHeight,
  }
})
console.log('MODAL', JSON.stringify(modalMetrics, null, 2))
await page.evaluate(() => {
  const panel = document.querySelector('.modal-panel')
  if (panel) panel.scrollTop = panel.scrollHeight
})
await wait(300)
await page.screenshot({ path: `${OUT}/24-trade-modal-bottom.png`, fullPage: false })
await page.keyboard.press('Escape')
await wait(400)

// 1024 screenshots
await page.setViewport({ width: 1024, height: 900, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173/#/stats', { waitUntil: 'domcontentloaded' })
await wait(800)
await page.screenshot({ path: `${OUT}/25-laptop-stats.png`, fullPage: false })
await page.goto('http://localhost:4173/#/entries', { waitUntil: 'domcontentloaded' })
await wait(800)
await page.screenshot({ path: `${OUT}/26-laptop-entries.png`, fullPage: false })

// Mobile top
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await wait(800)
await page.screenshot({ path: `${OUT}/27-mobile-top.png`, fullPage: false })

// Missing custom classes audit
const used = new Set()
const defined = new Set()
for (const path of ['/', '/accounts', '/stats', '/entries', '/notes', '/reports']) {
  await page.goto(`http://localhost:4173/#${path}`, { waitUntil: 'domcontentloaded' })
  await wait(500)
  const result = await page.evaluate(() => {
    const classes = new Set()
    document.querySelectorAll('[class]').forEach((el) => {
      const value = el.getAttribute('class') || ''
      value.split(/\s+/).forEach((name) => { if (name) classes.add(name) })
    })
    const rules = new Set()
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules = []
      try { cssRules = Array.from(sheet.cssRules) } catch { continue }
      for (const rule of cssRules) {
        if (rule.cssRules) {
          for (const inner of Array.from(rule.cssRules)) {
            if (inner.selectorText) {
              for (const match of inner.selectorText.matchAll(/\.([a-zA-Z_][\w-]*)/g)) rules.add(match[1])
            }
          }
        }
        if (rule.selectorText) {
          for (const match of rule.selectorText.matchAll(/\.([a-zA-Z_][\w-]*)/g)) rules.add(match[1])
        }
      }
    }
    return { classes: Array.from(classes), rules: Array.from(rules) }
  })
  result.classes.forEach((name) => used.add(name))
  result.rules.forEach((name) => defined.add(name))
}
const suspicious = [...used].filter((name) => !defined.has(name)).sort()
console.log('UNDEFINED CLASSES', suspicious)
fs.writeFileSync(`${OUT}/undefined-classes.json`, JSON.stringify(suspicious, null, 2))
fs.writeFileSync(`${OUT}/errors2.json`, JSON.stringify(errors, null, 2))
console.log('ERRORS', errors)
await browser.close()

