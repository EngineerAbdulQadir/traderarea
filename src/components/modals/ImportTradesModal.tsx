import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
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
import { parseMetaTraderHistory, type HistoryImportResult } from '@/lib/mtImport'
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

async function readStatement(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
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

    if (file.size > 12 * 1024 * 1024) {
      setError('That file is larger than 12 MB. Export a shorter history range from MetaTrader.')
      return
    }

    setBusy(true)
    try {
      const text = await readStatement(file)
      const parsed = parseMetaTraderHistory(text)
      if (!parsed.trades.length) {
        setError(
          'No closed trades were found. In MetaTrader, open Account History, right-click, choose Save as Report (HTML) or Export to CSV, then try again.',
        )
      } else {
        setResult(parsed)
      }
    } catch {
      setError('The file could not be read. Try exporting the history again from MetaTrader.')
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

  const handleImport = () => {
    if (!result || !accountId) return
    const account = accounts.find((item) => item.id === accountId)

    const trades: Trade[] = result.trades.map((item, index) => {
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
          ? `Imported from ${result.platform === 'Unknown' ? 'MetaTrader' : result.platform} · ticket ${item.ticket}`
          : '',
        manual: false,
      }
    })

    importTrades(trades)
    setActiveAccount(accountId)
    showToast(
      'Trade history imported',
      `${trades.length} trade${trades.length === 1 ? '' : 's'} loaded into ${account ? titleFor(account) : 'your journal'}.`,
    )
    onImported?.(result)
    onClose()
  }

  const previewTrades = result?.trades.slice(0, 6) ?? []
  const remaining = (result?.trades.length ?? 0) - previewTrades.length
  const wins = result?.trades.filter((trade) => trade.pnl > 0).length ?? 0
  const losses = result?.trades.filter((trade) => trade.pnl < 0).length ?? 0
  const breakEven = (result?.trades.length ?? 0) - wins - losses

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
            Load closed trades from an MT4 or MT5 statement. Duplicate tickets replace their previous import.
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
          accept=".html,.htm,.csv,.tsv,.txt"
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
              <span>HTML</span>
              <span>CSV</span>
              <span>TSV</span>
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
          <b>Save as Report</b> (HTML) or <b>Export</b> (CSV).
        </p>
      </div>

      <footer className="modal-foot import-foot">
        <span className="modal-foot-note">
          {result
            ? `${result.trades.length} trade${result.trades.length === 1 ? '' : 's'} ready to import`
            : 'No statement selected'}
        </span>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={handleImport}
          disabled={!result || !accountId}
          iconRight={<ArrowRight size={14} />}
        >
          {result ? `Import ${result.trades.length} trade${result.trades.length === 1 ? '' : 's'}` : 'Import trades'}
        </Button>
      </footer>
    </Modal>
  )
}
