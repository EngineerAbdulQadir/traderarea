import fs from 'node:fs'
import path from 'node:path'

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  )
}

const files = walk('src').filter((file) => file.endsWith('.tsx'))
const classes = new Set()
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const patterns = [
    /className=(?:\{cn\()?['"]([^'"]+)['"]/g,
    /'([^']*\b(?:page|card|grid|row|tile|strip|kpi|toolbar|table|head|foot|note|entry|report|account|trade|day|field|modal|chart|list|bar|tag|insight|stat|summary|phase|badge|chip|rule|calendar|edge|balance|streak|grade|side|heatmap|column|histogram|radar|donut|pf|empty|demo|toast|command|nav|brand|sidebar|topbar|hero|metric|dash|notes|reports|entries|accounts|stats|challenge|form|seg|icon|avatar|pill|btn)[^']*)'/g,
  ]
  for (const regex of patterns) {
    let match
    while ((match = regex.exec(source))) {
      match[1].split(/\s+/).forEach((name) => {
        const clean = name.replace(/^.*:/, '')
        if (/^[a-z][a-z0-9_-]*$/i.test(clean)) classes.add(clean)
      })
    }
  }
}

const css = fs.readFileSync('src/index.css', 'utf8')
const defined = new Set([...css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((match) => match[1]))
const missing = [...classes].filter((name) => !defined.has(name)).sort()
console.log(missing.join('\n'))
