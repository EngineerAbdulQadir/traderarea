import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/AQI/AppData/Local/Temp/ta-qa'
const DOWNLOADS = path.join(OUT, 'downloads')
fs.mkdirSync(DOWNLOADS, { recursive: true })
for (const file of fs.readdirSync(DOWNLOADS)) fs.unlinkSync(path.join(DOWNLOADS, file))

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

const visible = `(el) => el.offsetParent !== null`
async function clickText(selector, text, exact = false) {
  const clicked = await page.$$eval(
    selector,
    (nodes, needle, isExact) => {
      const node = nodes.find((item) => {
        if (item.offsetParent === null) return false
        const value = item.textContent?.trim() ?? ''
        return isExact ? value === needle : value.includes(needle)
      })
      if (!node) return false
      node.click()
      return true
    },
    text,
    exact,
  )
  if (!clicked) throw new Error(`Could not find visible ${selector} containing "${text}"`)
  await wait(600)
}

async function fill(selector, value) {
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type(String(value), { delay: 12 })
}

async function state() {
  return page.evaluate(() => ({
    accounts: JSON.parse(localStorage.getItem('ta-accounts') || '[]'),
    trades: JSON.parse(localStorage.getItem('ta-trades') || '[]'),
    notes: JSON.parse(localStorage.getItem('ta-notes') || '{}'),
    active: localStorage.getItem('ta-active-account'),
    hash: location.hash,
    body: document.body.innerText.slice(0, 400),
  }))
}

await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'domcontentloaded' })
await wait(1000)
fs.writeFileSync(`${OUT}/aqa-00-empty.png`, await page.screenshot({ fullPage: true }))
console.log('empty', (await state()).accounts.length)

// Create a challenge
await clickText('.empty-actions button', 'Start a challenge', true)
await page.waitForSelector('.modal-panel')
await wait(500)
fs.writeFileSync(`${OUT}/aqa-01-challenge.png`, await page.screenshot())
await clickText('.modal-foot button', 'Create challenge')

await page.waitForFunction(() => JSON.parse(localStorage.getItem('ta-accounts') || '[]').length === 1, { timeout: 5000 })
await wait(900)
let s = await state()
console.log('created account', s.accounts[0]?.firm, s.accounts[0]?.stage, s.accounts[0]?.challengeSize, 'active=', s.active)
fs.writeFileSync(`${OUT}/aqa-02-accounts-new.png`, await page.screenshot({ fullPage: true }))

// Challenge creation lands on Accounts; open the dashboard for the new workspace.
await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.dashboard-page', { timeout: 5000 })
await wait(900)
fs.writeFileSync(`${OUT}/aqa-02-dashboard-new.png`, await page.screenshot({ fullPage: true }))

// Add a trade
await clickText('button', 'Log trade')
await page.waitForSelector('#trade-symbol')
await wait(300)
await fill('#trade-symbol', 'AAPL')
await fill('#trade-qty', '100')
await fill('#trade-pnl', '250')
await fill('#trade-setup', 'Opening Range Break')
await fill('#trade-note', 'A+ setup. Waited for the retest, sized correctly and let the runner work.')
fs.writeFileSync(`${OUT}/aqa-03-trade-filled.png`, await page.screenshot())
await clickText('.modal-foot button', 'Save trade')
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ta-trades') || '[]').length === 1, { timeout: 5000 })
await wait(900)
s = await state()
console.log('saved trade', s.trades[0])
console.log('trade note saved?', (s.trades[0]?.note || '').startsWith('A+ setup.'))
fs.writeFileSync(`${OUT}/aqa-04-dashboard-with-trade.png`, await page.screenshot({ fullPage: true }))

// Entries page + edit
await page.goto('http://localhost:4173/#/entries', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.entries-page', { timeout: 5000 })
await wait(700)
const entriesText = await page.evaluate(() => document.body.innerText)
console.log('entries has AAPL', entriesText.includes('AAPL'), 'entries has $250', entriesText.includes('$250'))
fs.writeFileSync(`${OUT}/aqa-05-entries-one-trade.png`, await page.screenshot())

await page.click('.entry-edit')
await page.waitForSelector('#trade-pnl')
await wait(500)
await fill('#trade-pnl', '300')
await clickText('.modal-foot button', 'Save changes')
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ta-trades') || '[]')[0]?.pnl === 300, { timeout: 5000 })
console.log('edited pnl', (await state()).trades[0].pnl)

// Delete trade via nested confirmation
await wait(700)
await page.click('.entry-edit')
await page.waitForSelector('#trade-pnl')
await wait(400)
await clickText('.modal-foot .btn-danger', 'Delete', true)
await page.waitForSelector('.form-confirm')
fs.writeFileSync(`${OUT}/aqa-06-delete-confirm.png`, await page.screenshot())
await clickText('.form-confirm .btn-danger', 'Delete', true)
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ta-trades') || '[]').length === 0, { timeout: 5000 })
await wait(800)
console.log('deleted trades', (await state()).trades.length)

// Day note
await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.dashboard-page', { timeout: 5000 })
await wait(900)
await page.evaluate(() => window.scrollTo(0, 1150))
await wait(300)
const todayButton = await page.$('.calendar-day.is-today:not(:disabled)')
if (!todayButton) throw new Error('No clickable today cell')
await todayButton.click()
await page.waitForSelector('.day-modal')
await wait(700)
fs.writeFileSync(`${OUT}/aqa-07-day-review-empty.png`, await page.screenshot())
await page.click('.day-note-empty')
await page.waitForSelector('#day-note-input')
await wait(300)
await page.click('#day-note-input')
await page.keyboard.type('Waited for the first pullback and only took the A+ setup. No forcing trades on a slow tape.', { delay: 4 })
await clickText('.day-note-foot button', 'Save note')
await wait(800)
s = await state()
const noteKeys = Object.keys(s.notes[s.accounts[0].id] || {})
const savedDayNote = s.notes[s.accounts[0].id]?.['2026-11-03']?.text
console.log('note keys', noteKeys, 'day note', savedDayNote?.slice(0, 60))
await page.keyboard.press('Escape')
await wait(500)

// Notes page
await page.goto('http://localhost:4173/#/notes', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.notes-page', { timeout: 5000 })
await wait(700)
const notesText = await page.evaluate(() => document.body.innerText)
console.log('notes page has note', notesText.includes('Waited for the first pullback'))
fs.writeFileSync(`${OUT}/aqa-08-notes-saved.png`, await page.screenshot({ fullPage: true }))

// CSV export from entries (demo will be shown again after deleting the only real trade)
const client = await page.target().createCDPSession()
await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS })
await page.goto('http://localhost:4173/#/entries', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.entries-page', { timeout: 5000 })
await wait(700)
await clickText('.page-actions button', 'Export')
await wait(1500)
const files = fs.readdirSync(DOWNLOADS)
console.log('downloads', files)
if (files.length) {
  const content = fs.readFileSync(path.join(DOWNLOADS, files[0]), 'utf8')
  console.log('csv head', content.split('\n').slice(0, 2))
}

// Persistence
await page.reload({ waitUntil: 'domcontentloaded' })
await wait(1300)
s = await state()
console.log('after reload accounts', s.accounts.length, 'trades', s.trades.length, 'note text?', JSON.stringify(s.notes).includes('Waited for the first pullback'))

// Remove account
await page.goto('http://localhost:4173/#/accounts', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.accounts-page', { timeout: 5000 })
await wait(700)
const remove = await page.$('.account-remove')
if (!remove) throw new Error('No remove button')
await remove.click()
await page.waitForSelector('.confirm-panel, .modal-panel')
await wait(500)
fs.writeFileSync(`${OUT}/aqa-09-remove-account.png`, await page.screenshot())
await clickText('button', 'Remove account', true)
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ta-accounts') || '[]').length === 0, { timeout: 5000 })
await wait(800)
console.log('after remove accounts', (await state()).accounts.length)

fs.writeFileSync(`${OUT}/aqa-10-empty-after-remove.png`, await page.screenshot({ fullPage: true }))
fs.writeFileSync(`${OUT}/aqa-errors.json`, JSON.stringify(errors, null, 2))
console.log('ERRORS', errors)
await browser.close()




