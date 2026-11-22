import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useApp } from '@/store/AppStore'
import { accountStageLabel, titleFor } from '@/lib/accounts'
import { formatNumericDate, todayISO } from '@/lib/dates'
import { signedMoney } from '@/lib/format'
import {
  parseMetaTraderHistory,
  parseMetaTraderRows,
  type HistoryImportResult,
  type ImportedTrade,
} from '@/lib/mtImport'
import { readXlsxRows } from '@/lib/xlsx'
import { buildImportedTradeBaseKey, isDuplicateTrade } from '@/lib/trades'
import type { Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

type ImportScope = 'today' | 'all'

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
  id: string,
  accountId: string,
  platform: HistoryImportResult['platform'],
): Trade {
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
    ...(item.ticket ? { ticket: item.ticket } : {}),
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
    brokerAccounts,
    allAccounts,
    activeAccount,
    setActiveAccount,
    importTrades,
    showToast,
    getAllTradesForAccount,
    isDemo,
  } = useApp()

  const inputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [accountId, setAccountId] = useState(activeAccount?.id ?? allAccounts[0]?.id ?? '')
  const [scope, setScope] = useState<ImportScope>('today')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<HistoryImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const today = useMemo(() => todayISO(), [open])

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) return
    setAccountId(activeAccount?.id ?? allAccounts[0]?.id ?? '')
    setScope('today')
    setFileName('')
    setResult(null)
    setBusy(false)
    setError('')
    setDragging(false)
  }, [open, activeAccount?.id, allAccounts])

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

  const todayCount = useMemo(
    () => (result ? result.trades.filter((trade) => trade.date === today).length : 0),
    [result, today],
  )

  const scopedTrades = useMemo(
    () => (result ? result.trades.filter((item) => (scope === 'today' ? item.date === today : true)) : []),
    [result, scope, today],
  )

  const scopedPnl = useMemo(
    () => round2(scopedTrades.reduce((total, trade) => total + trade.pnl, 0)),
    [scopedTrades],
  )

  const targetAccount = useMemo(
    () => allAccounts.find((item) => item.id === accountId),
    [allAccounts, accountId],
  )

  const existingAccountTrades = useMemo(() => {
    if (!targetAccount || isDemo(targetAccount)) return [] as Trade[]
    return getAllTradesForAccount(targetAccount)
  }, [targetAccount, isDemo, getAllTradesForAccount])

  const importPreview = useMemo(() => {
    if (!result || !accountId) {
      return { trades: [] as Trade[], newItems: [] as ImportedTrade[], duplicates: 0 }
    }
    const prepared: Trade[] = []
    const newItems: ImportedTrade[] = []
    let duplicates = 0

    scopedTrades.forEach((item) => {
      const id = buildImportedTradeBaseKey(accountId, item)
      const trade = tradeFromImport(item, id, accountId, result.platform)
      if (existingAccountTrades.some((tradeRow) => isDuplicateTrade(tradeRow, trade))) {
        duplicates += 1
        return
      }
      if (prepared.some((tradeRow) => isDuplicateTrade(tradeRow, trade))) {
        duplicates += 1
        return
      }
      prepared.push(trade)
      newItems.push(item)
    })

    return { trades: prepared, newItems, duplicates }
  }, [result, accountId, existingAccountTrades, scopedTrades])

  const handleImport = () => {
    if (!result || !accountId) return
    const account = allAccounts.find((item) => item.id === accountId)
    const trades = importPreview.trades
    const scopedDates = scopedTrades.map((trade) => trade.date).filter(Boolean).sort()
    const scopedResult: HistoryImportResult = {
      ...result,
      trades: scopedTrades,
      totalPnl: scopedPnl,
      from: scopedDates[0] ?? result.from,
      to: scopedDates[scopedDates.length - 1] ?? result.to,
    }

    if (!trades.length) {
      showToast(
        scope === 'today' ? "Today's trades already imported" : 'History already imported',
        `All ${scopedTrades.length} trade${scopedTrades.length === 1 ? '' : 's'} ${scope === 'today' ? 'from today ' : ''}already exist in ${account ? titleFor(account) : 'this account'}. Nothing was duplicated.`,
        'info',
      )
      onImported?.(scopedResult)
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
      scope === 'today' ? "Today's trades imported" : 'Trade history imported',
      `${trades.length} trade${trades.length === 1 ? '' : 's'} ${scope === 'today' ? 'for today ' : ''}loaded into ${account ? titleFor(account) : 'your journal'}${statement}.${duplicateNote}`,
    )
    onImported?.(scopedResult)
    onClose()
  }

  const previewSource = importPreview.newItems.length ? importPreview.newItems : scopedTrades
  const previewTrades = previewSource.slice(0, 6)
  const remaining = previewSource.length - previewTrades.length
  const wins = scopedTrades.filter((trade) => trade.pnl > 0).length
  const losses = scopedTrades.filter((trade) => trade.pnl < 0).length
  const breakEven = scopedTrades.length - wins - losses
  const ignoredOlderCount = result ? result.trades.length - scopedTrades.length : 0

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

  const footerNote = !result
    ? 'No statement selected'
    : scope === 'today' && scopedTrades.length === 0
      ? `No trades closed today (${formatNumericDate(today)})`
      : `${importPreview.trades.length} new trade${importPreview.trades.length === 1 ? '' : 's'} ready${importPreview.duplicates ? ` · ${importPreview.duplicates} duplicate${importPreview.duplicates === 1 ? '' : 's'} skipped` : ''}`

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
            Choose whether to import only today’s closed trades or the whole statement history. Previous days stay untouched when importing today only.
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
            {accounts.length > 0 && (
              <optgroup label="Firms">
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {titleFor(account)} · {accountStageLabel(account)}
                  </option>
                ))}
              </optgroup>
            )}
            {brokerAccounts.length > 0 && (
              <optgroup label="Brokers">
                {brokerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {titleFor(account)} · {account.firm} · {accountStageLabel(account)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="field">
          <span className="field-label" id="import-scope-label">
            What would you like to import?
          </span>
          <div className="import-scope-grid" role="radiogroup" aria-labelledby="import-scope-label">
            <button
              type="button"
              role="radio"
              aria-checked={scope === 'today'}
              className={cn('import-scope-card', scope === 'today' && 'is-active')}
              onClick={() => setScope('today')}
            >
              <div className="import-scope-top">
                <span className="import-scope-icon">
                  <CalendarDays size={15} />
                </span>
                <span className="import-scope-meta">
                  {result ? `${todayCount} trade${todayCount === 1 ? '' : 's'}` : formatNumericDate(today)}
                </span>
              </div>
              <b>Current day only</b>
              <small>Import only trades closed today so previous days are not merged or changed.</small>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={scope === 'all'}
              className={cn('import-scope-card', scope === 'all' && 'is-active')}
              onClick={() => setScope('all')}
            >
              <div className="import-scope-top">
                <span className="import-scope-icon">
                  <History size={15} />
                </span>
                <span className="import-scope-meta">
                  {result
                    ? `${result.trades.length} trade${result.trades.length === 1 ? '' : 's'}`
                    : 'All dates'}
                </span>
              </div>
              <b>Whole history</b>
              <small>Import every closed trade in the Excel or HTML file, skipping duplicates.</small>
            </button>
          </div>
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
                {scope === 'today' && scopedTrades.length !== result.trades.length
                  ? `${scopedTrades.length} of ${result.trades.length} today`
                  : `${scopedTrades.length} trade${scopedTrades.length === 1 ? '' : 's'}`}
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
                <span>{scope === 'today' ? "Today's trades" : 'Trades'}</span>
                <b>{scopedTrades.length}</b>
                <small>
                  {wins}W · {losses}L{breakEven ? ` · ${breakEven}BE` : ''}
                </small>
              </div>
              <div className="import-stat">
                <span>Net P&amp;L</span>
                <b className={scopedPnl >= 0 ? 'is-pos' : 'is-neg'}>{signedMoney(scopedPnl)}</b>
                <small>{scope === 'today' ? 'For today only' : 'Across the statement'}</small>
              </div>
              <div className="import-stat">
                <span>Period</span>
                <b className="import-period">
                  {scope === 'today'
                    ? formatNumericDate(today)
                    : result.from && result.to
                      ? `${formatNumericDate(result.from)} – ${formatNumericDate(result.to)}`
                      : '—'}
                </b>
                <small>
                  {scope === 'today'
                    ? ignoredOlderCount > 0
                      ? `${ignoredOlderCount} earlier trade${ignoredOlderCount === 1 ? '' : 's'} ignored`
                      : 'Current day only'
                    : result.skipped
                      ? `${result.skipped} skipped`
                      : 'All rows read'}
                </small>
              </div>
            </div>

            {scopedTrades.length === 0 ? (
              <div className="import-empty-scope">
                <div className="import-empty-scope-copy">
                  <b>No closed trades found for {formatNumericDate(today)}</b>
                  <span>
                    This file contains {result.trades.length} trade{result.trades.length === 1 ? '' : 's'} from{' '}
                    {result.from && result.to
                      ? `${formatNumericDate(result.from)} – ${formatNumericDate(result.to)}`
                      : 'earlier dates'}
                    .
                  </span>
                </div>
                <Button variant="secondary" size="sm" type="button" onClick={() => setScope('all')}>
                  Switch to Whole history
                </Button>
              </div>
            ) : importPreview.trades.length === 0 ? (
              <div className="import-empty-scope">
                <div className="import-empty-scope-copy">
                  <b>
                    All {scopedTrades.length} trade{scopedTrades.length === 1 ? '' : 's'}{' '}
                    {scope === 'today' ? 'from today ' : ''}already imported
                  </b>
                  <span>
                    {importPreview.duplicates} duplicate{importPreview.duplicates === 1 ? '' : 's'} matched your journal
                    for {targetAccount ? titleFor(targetAccount) : 'this account'} and will not be copied again.
                  </span>
                </div>
                {scope === 'today' && ignoredOlderCount > 0 && (
                  <Button variant="secondary" size="sm" type="button" onClick={() => setScope('all')}>
                    Check Whole history
                  </Button>
                )}
              </div>
            ) : (
              <div className="import-preview">
                <div className="import-preview-head">
                  <span>Date</span>
                  <span>Symbol</span>
                  <span>Side</span>
                  <span>Size</span>
                  <span>P&amp;L</span>
                </div>
                {previewTrades.map((trade, idx) => (
                  <div
                    className="import-preview-row"
                    key={`${trade.ticket}-${trade.date}-${trade.closeTime}-${trade.symbol}-${trade.pnl}-${idx}`}
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
                {(remaining > 0 || importPreview.duplicates > 0) && (
                  <p className="import-preview-more">
                    {remaining > 0 ? `+ ${remaining} more new trade${remaining === 1 ? '' : 's'}` : ''}
                    {remaining > 0 && importPreview.duplicates > 0 ? ' · ' : ''}
                    {importPreview.duplicates > 0
                      ? `${importPreview.duplicates} duplicate${importPreview.duplicates === 1 ? '' : 's'} skipped`
                      : ''}
                  </p>
                )}
              </div>
            )}

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
          <b>Save as Report</b> (HTML or XLSX). Choose <b>Current day only</b> to import just today’s
          trades, or <b>Whole history</b> to import the entire statement.
        </p>
      </div>

      <footer className="modal-foot import-foot">
        <span className="modal-foot-note">{footerNote}</span>
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

