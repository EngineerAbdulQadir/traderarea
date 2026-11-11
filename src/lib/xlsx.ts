/**
 * Minimal XLSX reader.
 *
 * MetaTrader 5 can save a Trade History Report as an Excel workbook. We only
 * need the first worksheet as a grid of strings, so this avoids pulling in a
 * full spreadsheet dependency. It supports the two compression modes found in
 * real exports (stored and deflate) plus the UTF-16 XML that some brokers write.
 */

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function readEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minOffset = Math.max(0, bytes.length - 66_000)
  let eocd = -1
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocd = offset
      break
    }
  }
  if (eocd < 0) throw new Error('Not a valid XLSX file')

  const entryCount = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const entries = new Map<string, ZipEntry>()

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decodeText(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, { name, method, compressedSize, localOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read XLSX files. Export the report as HTML or CSV instead.')
  }
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function readEntry(
  bytes: Uint8Array,
  entry: ZipEntry | undefined,
): Promise<Uint8Array | null> {
  if (!entry) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) return null

  const nameLength = view.getUint16(entry.localOffset + 26, true)
  const extraLength = view.getUint16(entry.localOffset + 28, true)
  const start = entry.localOffset + 30 + nameLength + extraLength
  const data = bytes.subarray(start, start + entry.compressedSize)

  if (entry.method === 0) return data
  if (entry.method === 8) return inflateRaw(data)
  throw new Error('Unsupported compression inside the XLSX file')
}

function xmlDocument(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function elementText(element: Element): string {
  return Array.from(element.getElementsByTagName('t'))
    .map((node) => node.textContent ?? '')
    .join('')
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return []
  const doc = xmlDocument(xml)
  return Array.from(doc.getElementsByTagName('si')).map(elementText)
}

function firstSheetPath(workbook: string | null, relationships: string | null): string | null {
  if (!workbook) return null
  const doc = xmlDocument(workbook)
  const sheet = doc.getElementsByTagName('sheet')[0]
  if (!sheet) return null

  const relId =
    sheet.getAttribute('r:id') ??
    sheet.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    )

  if (relId && relationships) {
    const relDoc = xmlDocument(relationships)
    const rel = Array.from(relDoc.getElementsByTagName('Relationship')).find(
      (item) => item.getAttribute('Id') === relId,
    )
    const target = rel?.getAttribute('Target') ?? ''
    if (target) {
      const clean = target.replace(/^\//, '').replace(/^xl\//, '')
      return `xl/${clean}`
    }
  }

  return null
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0] ?? ''
  let column = 0
  for (const letter of letters.toUpperCase()) {
    column = column * 26 + (letter.charCodeAt(0) - 64)
  }
  return Math.max(0, column - 1)
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const doc = xmlDocument(xml)
  const rows: string[][] = []

  Array.from(doc.getElementsByTagName('row')).forEach((rowElement) => {
    const row: string[] = []
    let fallbackColumn = 0

    Array.from(rowElement.getElementsByTagName('c')).forEach((cell) => {
      const reference = cell.getAttribute('r') ?? ''
      const column = reference ? columnIndex(reference) : fallbackColumn
      fallbackColumn = column + 1

      const type = cell.getAttribute('t') ?? ''
      let value = ''

      if (type === 'inlineStr') {
        value = elementText(cell)
      } else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent ?? ''
        if (type === 's') value = sharedStrings[Number(raw)] ?? ''
        else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE'
        else value = raw
      }

      row[column] = value
    })

    for (let index = 0; index < row.length; index += 1) {
      if (row[index] === undefined) row[index] = ''
    }
    rows.push(row)
  })

  return rows
}

/** Read the first worksheet of an .xlsx workbook as a grid of strings. */
export async function readXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const entries = readEntries(bytes)

  const workbookBytes = await readEntry(bytes, entries.get('xl/workbook.xml'))
  const relsBytes = await readEntry(bytes, entries.get('xl/_rels/workbook.xml.rels'))
  const sharedBytes = await readEntry(bytes, entries.get('xl/sharedStrings.xml'))

  const workbook = workbookBytes ? decodeText(workbookBytes) : null
  const relationships = relsBytes ? decodeText(relsBytes) : null
  const sharedStrings = parseSharedStrings(sharedBytes ? decodeText(sharedBytes) : null)

  let sheetPath = firstSheetPath(workbook, relationships)
  if (!sheetPath || !entries.has(sheetPath)) {
    sheetPath = Array.from(entries.keys())
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort()[0]
  }
  if (!sheetPath) throw new Error('The workbook does not contain a worksheet')

  const sheetBytes = await readEntry(bytes, entries.get(sheetPath))
  if (!sheetBytes) throw new Error('The worksheet could not be read')

  return parseSheet(decodeText(sheetBytes), sharedStrings)
}
