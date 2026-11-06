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

async function clickText(selector, text) {
  const clicked = await page.$$eval(
    selector,
    (nodes, needle) => {
      const node = nodes.find((item) => item.textContent?.trim().includes(needle))
      if (!node) return false
      node.click()
      return true
    },
    text,
  )
  if (!clicked) throw new Error(`Could not find ${selector} containing "${text}"`)
  await wait(700)
}

async function shot(name, fullPage = true) {
  await wait(500)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log(`shot ${name}`)
}

await page.goto('http://localhost:4173/#/', { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await wait(700)
await shot('01-dashboard-empty')

await clickText('button', 'Load demo workspace')
await page.waitForSelector('.hero-card', { timeout: 5000 })
await wait(1000)
await shot('02-dashboard')

const routes = [
  ['accounts', '03-accounts'],
  ['stats', '04-stats'],
  ['entries', '05-entries'],
  ['notes', '06-notes'],
  ['reports', '07-reports'],
]
for (const [route, name] of routes) {
  await page.goto(`http://localhost:4173/#/${route}`, { waitUntil: 'networkidle0' })
  await wait(900)
  await shot(name)
}

// Dashboard interactions
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173/#/', { waitUntil: 'networkidle0' })
await wait(700)
await clickText('button', 'Log trade')
await page.waitForSelector('.modal-panel', { timeout: 5000 })
await shot('08-trade-modal', false)
await page.click('.modal-x')
await wait(500)
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })

await page.keyboard.down('Control')
await page.keyboard.press('KeyK')
await page.keyboard.up('Control')
await wait(500)
await shot('09-command-palette', false)
await page.keyboard.press('Escape')
await wait(400)

await clickText('button', 'Challenge')
await page.waitForSelector('.modal-panel', { timeout: 5000 })
await shot('10-challenge-modal', false)
await page.keyboard.press('Escape')
await wait(500)

// Open a day review from calendar if possible
const dayButtons = await page.$$('.calendar-day:not(.is-outside)')
if (dayButtons.length) {
  await dayButtons[Math.min(12, dayButtons.length - 1)].click()
  await wait(700)
  await shot('11-day-review', false)
  await page.keyboard.press('Escape')
  await wait(300)
}

// Mobile
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173/#/', { waitUntil: 'networkidle0' })
await wait(900)
await shot('12-mobile-dashboard')
await page.click('.mobile-menu')
await wait(600)
await shot('13-mobile-nav', false)
await page.keyboard.press('Escape')
await wait(400)

await page.goto('http://localhost:4173/#/entries', { waitUntil: 'networkidle0' })
await wait(900)
await shot('14-mobile-entries', false)
await page.evaluate(() => window.scrollTo(0, 500))
await wait(400)
await shot('14b-mobile-entries-scroll', false)

await page.goto('http://localhost:4173/#/', { waitUntil: 'networkidle0' })
await wait(900)
await page.evaluate(() => window.scrollTo(0, 700))
await wait(400)
await shot('12b-mobile-dashboard-mid', false)
await page.evaluate(() => window.scrollTo(0, 2000))
await wait(400)
await shot('12c-mobile-dashboard-calendar', false)

// Tablet
await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173/#/stats', { waitUntil: 'networkidle0' })
await wait(900)
await shot('15-tablet-stats')

// Inspect horizontal overflow at each viewport / page
const viewports = [
  { width: 1440, height: 1000, tag: 'desktop' },
  { width: 1024, height: 900, tag: 'laptop' },
  { width: 768, height: 900, tag: 'tablet' },
  { width: 390, height: 844, tag: 'mobile' },
  { width: 360, height: 800, tag: 'small' },
]
const paths = ['', 'accounts', 'stats', 'entries', 'notes', 'reports']
const overflow = []
for (const vp of viewports) {
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
  for (const path of paths) {
    await page.goto(`http://localhost:4173/#/${path}`, { waitUntil: 'networkidle0' })
    await wait(500)
    const result = await page.evaluate(() => {
      const doc = document.documentElement
      const offenders = []
      document.querySelectorAll('body *').forEach((el) => {
        const style = getComputedStyle(el)
        if (style.position === 'fixed' || style.display === 'none') return
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1)) {
          offenders.push({
            tag: el.tagName,
            cls: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          })
        }
      })
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offenders: offenders.slice(0, 12),
      }
    })
    overflow.push({ viewport: vp.tag, path: path || 'dashboard', ...result })
  }
}

fs.writeFileSync(`${OUT}/overflow.json`, JSON.stringify(overflow, null, 2))
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2))
console.log('ERRORS', errors)
console.log('OVERFLOW')
for (const row of overflow) {
  if (row.scrollWidth > row.innerWidth + 1 || row.offenders.length) {
    console.log(row.viewport, row.path, row.scrollWidth, row.innerWidth, JSON.stringify(row.offenders))
  }
}

await browser.close()
