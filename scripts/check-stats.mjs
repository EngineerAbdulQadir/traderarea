import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  defaultViewport: { width: 1024, height: 900, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
const errors = []
page.on('console', (message) => console.log('console', message.type(), message.text()))
page.on('pageerror', (error) => errors.push(error.message))

await page.goto('http://localhost:4173/#/', { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((resolve) => setTimeout(resolve, 500))
await page.$$eval('button', (nodes) => nodes.find((node) => node.textContent?.includes('Load demo workspace'))?.click())
await page.waitForSelector('.hero-card')
await new Promise((resolve) => setTimeout(resolve, 800))

for (const ms of [50, 200, 500, 1000, 2000]) {
  await page.goto('http://localhost:4173/#/stats', { waitUntil: 'networkidle0' })
  await new Promise((resolve) => setTimeout(resolve, ms))
  const info = await page.evaluate(() => {
    const pageEl = document.querySelector('.page')
    const head = document.querySelector('.page-head')
    const kpis = document.querySelector('.stats-kpis')
    const style = pageEl ? getComputedStyle(pageEl) : null
    return {
      href: location.hash,
      page: pageEl ? pageEl.className : null,
      head: head ? head.getBoundingClientRect().toJSON() : null,
      kpis: kpis ? kpis.getBoundingClientRect().toJSON() : null,
      opacity: style?.opacity,
      transform: style?.transform,
      visibility: style?.visibility,
      contentHeight: pageEl?.getBoundingClientRect().height,
      bodyText: document.querySelector('.content')?.textContent?.slice(0, 120),
    }
  })
  console.log(ms, JSON.stringify(info))
}
console.log('errors', errors)
await browser.close()
