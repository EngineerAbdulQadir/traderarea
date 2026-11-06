import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/AQI/AppData/Local/Temp/ta-qa/v2'
fs.mkdirSync(OUT, { recursive: true })
const errors = []
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--force-device-scale-factor=1', '--font-render-hinting=none'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const shot = async (name, fullPage = true) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage }) }
const goto = async (path, ms = 1300) => {
  await page.goto(`http://localhost:4173/#${path}`, { waitUntil: 'domcontentloaded' })
  await wait(ms)
}
const diagnostics = async (label) => {
  const result = await page.evaluate(() => {
    const pageEl = document.querySelector('.page')
    const cards = document.querySelectorAll('.card, .stat-kpi, .account-card, .hero-card').length
    const rect = pageEl?.getBoundingClientRect()
    return {
      hash: location.hash,
      title: document.title,
      pageText: (pageEl?.innerText || '').trim().slice(0, 60),
      cards,
      pageRect: rect ? { top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) } : null,
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    }
  })
  console.log(label, JSON.stringify(result))
  return result
}

await goto('/', 800)
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'domcontentloaded' })
await wait(1200)
await page.$$eval('button', (nodes) => nodes.find((n) => n.textContent?.includes('Load demo workspace'))?.click())
await page.waitForSelector('.hero-card', { timeout: 8000 })
await wait(1500)
await diagnostics('desktop dashboard')

const routes = [['/', 'dashboard'], ['/accounts', 'accounts'], ['/stats', 'stats'], ['/entries', 'entries'], ['/notes', 'notes'], ['/reports', 'reports']]
for (const [path, name] of routes) {
  await goto(path, 1500)
  await diagnostics(`desktop ${name}`)
  await shot(`desktop-${name}`)
}

// Command palette
await goto('/', 1000)
await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control')
await wait(700)
await page.keyboard.type('log', { delay: 40 })
await wait(500)
const palette = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.command-item')).filter((el) => el.offsetParent !== null)
  return { count: items.length, labels: items.map((el) => el.innerText.split('\n')[0]) }
})
console.log('palette search', JSON.stringify(palette))
await shot('desktop-command-palette', false)
await page.keyboard.press('Escape'); await wait(500)

// Trade modal
await page.$$eval('button', (nodes) => nodes.find((n) => n.textContent?.trim() === 'Log trade')?.click())
await page.waitForSelector('.trade-form')
await wait(600)
await shot('desktop-trade-modal', false)
const modal = await page.evaluate(() => {
  const b = document.querySelector('.trade-body'); const f = document.querySelector('.trade-form'); const foot = document.querySelector('.modal-foot'); const note = document.querySelector('#trade-note')
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), h: Math.round(el.getBoundingClientRect().height) } : null
  return { form: r(f), body: r(b), foot: r(foot), note: r(note), bodyScroll: b ? { top: b.scrollTop, sh: b.scrollHeight, ch: b.clientHeight } : null }
})
console.log('trade modal', JSON.stringify(modal))
await page.evaluate(() => { const b = document.querySelector('.trade-body'); if (b) b.scrollTop = b.scrollHeight })
await wait(400)
await shot('desktop-trade-modal-scrolled', false)
await page.keyboard.press('Escape'); await wait(500)

// Challenge modal
await page.$$eval('button', (nodes) => nodes.find((n) => n.textContent?.trim() === '+ Challenge' || n.textContent?.trim() === 'Challenge')?.click())
await page.waitForSelector('.challenge-form', { timeout: 5000 })
await wait(600)
await shot('desktop-challenge-modal', false)
await page.keyboard.press('Escape'); await wait(500)

// Day review from calendar today
await page.evaluate(() => window.scrollTo(0, 1000))
await wait(500)
const today = await page.$('.calendar-day.is-today:not(:disabled)')
if (today) {
  await today.click()
  await page.waitForSelector('.day-modal')
  await wait(800)
  await diagnostics('day review open')
  await shot('desktop-day-review', false)
  await page.keyboard.press('Escape'); await wait(500)
}

// Light theme via the UI toggle so the app's theme store actually switches.
await goto('/', 1200)
if (await page.evaluate(() => document.documentElement.dataset.theme === 'dark')) {
  await page.click('[data-theme-toggle]')
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light' && getComputedStyle(document.body).backgroundColor === 'rgb(251, 251, 251)',
    { timeout: 5000 },
  )
}
await diagnostics('light dashboard')
await shot('light-dashboard')
await goto('/stats', 1500)
await shot('light-stats')
await goto('/entries', 1500)
await shot('light-entries')
if (await page.evaluate(() => document.documentElement.dataset.theme === 'light')) {
  await page.click('[data-theme-toggle]')
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'dark' && getComputedStyle(document.body).backgroundColor === 'rgb(15, 17, 19)',
    { timeout: 5000 },
  )
}

// Viewports
const viewports = [
  { w: 1280, h: 800, tag: 'laptop' },
  { w: 1024, h: 768, tag: 'tablet-landscape' },
  { w: 768, h: 1024, tag: 'tablet' },
  { w: 390, h: 844, tag: 'mobile' },
]
for (const vp of viewports) {
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 })
  for (const [path, name] of routes) {
    await goto(path, 1600)
    const d = await diagnostics(`${vp.tag} ${name}`)
    if (!d.pageText) errors.push(`blank page ${vp.tag} ${name}`)
    if (d.overflowX) errors.push(`horizontal overflow ${vp.tag} ${name}: ${d.docWidth}/${d.viewportWidth}`)
    await shot(`${vp.tag}-${name}`, vp.tag === 'mobile' || vp.tag === 'tablet' ? false : false)
  }
}

// Mobile modal and nav
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await goto('/', 1200)
await page.click('.mobile-menu')
await wait(700)
await shot('mobile-nav', false)
await page.keyboard.press('Escape'); await wait(400)
await page.$$eval('button', (nodes) => nodes.find((n) => n.textContent?.trim() === 'Log trade')?.click())
await page.waitForSelector('.trade-form')
await wait(700)
await shot('mobile-trade-modal', false)
await page.keyboard.press('Escape'); await wait(500)

fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2))
console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
