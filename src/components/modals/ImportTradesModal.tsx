import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowRight,
  CircleAlert,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useApp } from '@/store/AppStore'
import { titleFor } from '@/lib/accounts'
import { formatNumericDate } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import {
  parseMetaTraderHistory,
  parseMetaTraderRows,
  type HistoryImportResult,
  type ImportedTrade,
} from '@/lib/mtImport'
import { readXlsxRows } from '@/lib/xlsx'
import { isSameTradeData } from '@/lib/trades'
import type { Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

interface ImportTradesModalProps {
  open: boolean
  onClose: () => void
  onImported?: (result: HistoryImportResult) => void
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function tradeFromImport(
  item: ImportedTrade,
  index: number,
  accountId: string,
  platform: HistoryImportResult['platform'],
): Trade {
  const id = item.ticket
    ? `mt:${accountId}:${item.ticket}`
    : `mt:${accountId}:${item.date}:${item.closeTime}:${item.symbol}:${item.volume}:${item.pnl}:${index}`
  return {
    id,
    accountId,
    date: item.date,
    openTime: item.openTime,
    closeTime: item.closeTime,
    ticker: item.symbol,
    instrument: item.symbol,
    side: item.side,
    volume: item.volume,
    entry: item.entry,
    exit: item.exit,
    stopLoss: item.stopLoss || undefined,
    takeProfit: item.takeProfit || undefined,
    pnl: item.pnl,
    gross: round2(item.pnl + item.fees),
    fees: item.fees,
    roi: 0,
    rMultiple: 0,
    risk: 0,
    playbook: '—',
    quality: 50,
    tags: [],
    note: item.ticket
      ? `Imported from ${platform === 'Unknown' ? 'MetaTrader' : platform} · ticket ${item.ticket}`
      : '',
    manual: false,
  }
}

function readStatement(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes)
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 4000))
  let zeroes = 0
  sample.forEach((byte) => {
    if (byte === 0) zeroes += 1
  })
  if (sample.length > 0 && zeroes > sample.length * 0.18) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

export function ImportTradesModal({ open, onClose, onImported }: ImportTradesModalProps) {
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    importTrades,
    showToast,
    workspaceTrades,
  } = useApp()

  const inputRef = useRef<HTMLInputElement>(null)
  const [accountId, setAccountId] = useState(activeAccount?.id ?? accounts[0]?.id ?? '')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<HistoryImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!open) return
    setAccountId(activeAccount?.id ?? accounts[0]?.id ?? '')
    setFileName('')
    setResult(null)
    setBusy(false)
    setError('')
    setDragging(false)
  }, [open, activeAccount?.id, accounts])

  const readFile = async (file: File) => {
    setError('')
    setResult(null)
    setFileName(file.name)

    const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
    if (extension !== 'html' && extension !== 'htm' && extension !== 'xlsx') {
      setError(
        extension === 'xls'
          ? 'Old .xls workbooks are not supported. Re-save the report as .xlsx from MetaTrader, or export it as HTML.'
          : 'Only HTML and XLSX statements are supported. Export your history as an HTML or XLSX report from MetaTrader.',
      )
      return
    }

    if (file.size > 12 * 1024 * 1024) {
      setError('That file is larger than 12 MB. Export a shorter history range from MetaTrader.')
      return
    }

    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
      const isXlsx = extension === 'xlsx'
      let parsed: HistoryImportResult

      if (isXlsx) {
        if (!isZip) {
          setError(
            'Old .xls workbooks are not supported. Re-save the report as .xlsx from MetaTrader, or export it as HTML.',
          )
          return
        }
        const rows = await readXlsxRows(bytes)
        parsed = parseMetaTraderRows(rows)
      } else {
        parsed = parseMetaTraderHistory(readStatement(bytes))
      }

      if (!parsed.trades.length) {
        setError(
          'No closed trades were found. In MetaTrader, open Account History, right-click, choose Save as Report (HTML or XLSX), then try again.',
        )
      } else {
        setResult(parsed)
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'The file could not be read. Try exporting the history again from MetaTrader.',
      )
    } finally {
      setBusy(false)
    }
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void readFile(file)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void readFile(file)
  }

  const resetFile = () => {
    setResult(null)
    setFileName('')
    setError('')
  }

  const replaceFile = () => {
    resetFile()
    inputRef.current?.click()
  }

  const importPreview = useMemo(() => {
    if (!result || !accountId) return { trades: [] as Trade[], duplicates: 0 }
    const existing = workspaceTrades.filter((trade) => trade.accountId === accountId)
    const prepared: Trade[] = []
    let duplicates = 0

    result.trades.forEach((item, index) => {
      const trade = tradeFromImport(item, index, accountId, result.platform)
      const existingMatch = existing.find((tradeRow) => tradeRow.id === trade.id)
      if (existingMatch) {
        // Identical ticket: nothing to do. Changed data refreshes the row.
        if (isSameTradeData(existingMatch, trade)) {
          duplicates += 1
          return
        }
        prepared.push(trade)
        return
      }
      // Matches a trade already in the journal (for example one logged by
      // hand before the statement was re-imported): never add it twice.
      if (existing.some((tradeRow) => isSameTradeData(tradeRow, trade))) {
        duplicates += 1
        return
      }
      // The statement itself can repeat a row; only keep one of them.
      if (prepared.some((tradeRow) => isSameTradeData(tradeRow, trade))) {
        duplicates += 1
        return
      }
      prepared.push(trade)
    })

    return { trades: prepared, duplicates }
  }, [result, accountId, workspaceTrades])

  const handleImport = () => {
    if (!result || !accountId) return
    const account = accounts.find((item) => item.id === accountId)
    const trades = importPreview.trades

    if (!trades.length) {
      showToast(
        'History already imported',
        `All ${result.trades.length} trades already exist in ${account ? titleFor(account) : 'this account'}. Nothing was duplicated.`,
        'info',
      )
      onImported?.(result)
      onClose()
      return
    }

    importTrades(trades)
    setActiveAccount(accountId)
    const statement = result.meta.accountNumber ? ` (statement ${result.meta.accountNumber})` : ''
    const duplicateNote = importPreview.duplicates
      ? ` ${importPreview.duplicates} duplicate${importPreview.duplicates === 1 ? '' : 's'} skipped.`
      : ''
    showToast(
      'Trade history imported',
      `${trades.length} trade${trades.length === 1 ? '' : 's'} loaded into ${account ? titleFor(account) : 'your journal'}${statement}.${duplicateNote}`,
    )
    onImported?.(result)
    onClose()
  }

  const previewTrades = result?.trades.slice(0, 6) ?? []
  const remaining = (result?.trades.length ?? 0) - previewTrades.length
  const wins = result?.trades.filter((trade) => trade.pnl > 0).length ?? 0
  const losses = result?.trades.filter((trade) => trade.pnl < 0).length ?? 0
  const breakEven = (result?.trades.length ?? 0) - wins - losses

  const targetAccount = accounts.find((item) => item.id === accountId)
  const reportName = result?.meta.accountName ?? ''
  const firmWords = targetAccount
    ? targetAccount.firm
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2)
    : []
  const sourceMismatch =
    !!reportName &&
    firmWords.length > 0 &&
    !firmWords.some((word) => reportName.toLowerCase().includes(word))
  const sourceLabel = [reportName, result?.meta.accountNumber].filter(Boolean).join(' · ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="import-modal"
      labelledBy="import-title"
    >
      <header className="modal-head">
        <div className="modal-head-copy">
          <h2 className="modal-title" id="import-title">
            Import MetaTrader history
          </h2>
          <p className="modal-sub">
            Load closed trades from an MT4 or MT5 HTML or XLSX statement. Trades already in the journal are skipped, so re-importing never duplicates them.
          </p>
        </div>
        <ModalClose onClick={onClose} />
      </header>

      <div className="modal-body import-body">
        <div className="field">
          <label className="field-label" htmlFor="import-account">
            Import into account
          </label>
          <select
            className="select import-target-select"
            id="import-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {titleFor(account)} · {account.stage}
              </option>
            ))}
          </select>
        </div>

        <input
          ref={inputRef}
          className="import-file-input"
          id="import-file"
          type="file"
          accept=".html,.htm,.xlsx"
          onChange={onPick}
        />

        {!result && !busy && (
          <label
            className={cn('import-drop', dragging && 'is-dragging')}
            htmlFor="import-file"
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="import-drop-icon">
              <Upload size={22} />
            </span>
            <b>Drop your MetaTrader statement here</b>
            <span>
              or <em>browse files</em> to choose a statement
            </span>
            <div className="import-formats">
              <span>XLSX</span>
              <span>HTML</span>
            </div>
          </label>
        )}

        {busy && (
          <div className="import-drop is-busy" role="status" aria-live="polite">
            <span className="import-drop-icon">
              <Loader2 size={22} className="auth-spin" />
            </span>
            <b>Reading statement…</b>
            <span>Parsing closed trades and matching columns.</span>
          </div>
        )}

        {result && (
          <div className="import-review">
            <div className="import-file-row">
              <span className="import-file-icon">
                <FileText size={16} />
              </span>
              <div className="import-file-copy">
                <b>{fileName}</b>
                <span>
                  {result.platform === 'Unknown' ? 'MetaTrader' : result.platform} · {result.format} statement
                </span>
              </div>
              <Badge tone="accent">
                {result.trades.length} trade{result.trades.length === 1 ? '' : 's'}
              </Badge>
              <div className="import-file-actions">
                <button type="button" className="import-icon-btn" onClick={replaceFile} aria-label="Replace file">
                  <RefreshCw size={14} />
                </button>
                <button type="button" className="import-icon-btn" onClick={resetFile} aria-label="Remove file">
                  <X size={14} />
                </button>
              </div>
            </div>

            {sourceLabel && (
              <div className={cn('import-source', sourceMismatch && 'is-warn')}>
                <div className="import-source-head">
                  <span>Statement account</span>
                  {sourceMismatch && (
                    <span className="import-source-warn">
                      <CircleAlert size={12} />
                      Check target account
                    </span>
                  )}
                </div>
                <b>{sourceLabel}</b>
                <small>
                  {sourceMismatch
                    ? `This statement does not look like ${targetAccount ? titleFor(targetAccount) : 'the selected account'}. It will still be imported only into the account selected above.`
                    : 'These trades will be imported only into the account selected above.'}
                </small>
              </div>
            )}

            <div className="import-stats">
              <div className="import-stat">
                <span>Trades</span>
                <b>{result.trades.length}</b>
                <small>
                  {wins}W · {losses}L{breakEven ? ` · ${breakEven}BE` : ''}
                </small>
              </div>
              <div className="import-stat">
                <span>Net P&amp;L</span>
                <b className={result.totalPnl >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(result.totalPnl)}</b>
                <small>Across the statement</small>
              </div>
              <div className="import-stat">
                <span>Period</span>
                <b className="import-period">
                  {result.from && result.to
                    ? `${formatNumericDate(result.from)} – ${formatNumericDate(result.to)}`
                    : '—'}
                </b>
                <small>{result.skipped ? `${result.skipped} skipped` : 'All rows read'}</small>
              </div>
            </div>

            <div className="import-preview">
              <div className="import-preview-head">
                <span>Date</span>
                <span>Symbol</span>
                <span>Side</span>
                <span>Size</span>
                <span>P&amp;L</span>
              </div>
              {previewTrades.map((trade) => (
                <div
                  className="import-preview-row"
                  key={`${trade.ticket}-${trade.date}-${trade.symbol}-${trade.pnl}`}
                >
                  <span className="import-preview-date">{formatNumericDate(trade.date)}</span>
                  <span className="import-preview-symbol">{trade.symbol}</span>
                  <Badge tone={trade.side === 'LONG' ? 'pos' : 'neg'}>
                    {trade.side === 'LONG' ? 'Long' : 'Short'}
                  </Badge>
                  <span className="import-preview-volume">{trade.volume || '—'}</span>
                  <b className={trade.pnl >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(trade.pnl)}</b>
                </div>
              ))}
              {remaining > 0 && (
                <p className="import-preview-more">
                  + {remaining} more trade{remaining === 1 ? '' : 's'} in this statement
                </p>
              )}
            </div>

            {result.skipped > 0 && (
              <p className="import-skipped">
                {result.skipped} row{result.skipped === 1 ? '' : 's'} could not be read and will be skipped.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            <CircleAlert size={13} />
            {error}
          </div>
        )}

        <p className="import-note">
          Export from MetaTrader: open <b>Account History</b>, right-click, then choose{' '}
          <b>Save as Report</b> (HTML or XLSX). Only the closed positions in the statement are
          imported, and trades already in the journal are skipped.
        </p>
      </div>

      <footer className="modal-foot import-foot">
        <span className="modal-foot-note">
          {result
            ? `${importPreview.trades.length} new trade${importPreview.trades.length === 1 ? '' : 's'} ready${importPreview.duplicates ? ` · ${importPreview.duplicates} duplicate${importPreview.duplicates === 1 ? '' : 's'} skipped` : ''}`
            : 'No statement selected'}
        </span>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={handleImport}
          disabled={!result || !accountId || !importPreview.trades.length}
          iconRight={<ArrowRight size={14} />}
        >
          {result
            ? `Import ${importPreview.trades.length} trade${importPreview.trades.length === 1 ? '' : 's'}`
            : 'Import trades'}
        </Button>
      </footer>
    </Modal>
  )
}
