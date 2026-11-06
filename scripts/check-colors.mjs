import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1440, height: 1000 } })
const page = await browser.newPage()
await page.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))
console.log(JSON.stringify(await page.evaluate(() => {
  const sheets = []
  for (const sheet of document.styleSheets) {
    let count = 0
    let sample = []
    try {
      count = sheet.cssRules.length
      for (const rule of sheet.cssRules) {
        const text = rule.cssText || ''
        if (text.includes('--accent') || text.includes('.btn-primary') || text.includes('--bg:') || text.includes('--bg ')) sample.push(text.slice(0, 300))
      }
    } catch (error) { sample.push('ERR ' + error.message) }
    sheets.push({ href: sheet.href, owner: sheet.ownerNode?.tagName, count, sample: sample.slice(0, 5) })
  }
  const styles = Array.from(document.querySelectorAll('style')).map(n => ({ id: n.id, len: n.textContent?.length, head: n.textContent?.slice(0, 200) }))
  return { sheets, styles, htmlClass: document.documentElement.className, links: Array.from(document.querySelectorAll('link')).map(l => ({ rel: l.rel, href: l.href })) }
}), null, 2))
await browser.close()
