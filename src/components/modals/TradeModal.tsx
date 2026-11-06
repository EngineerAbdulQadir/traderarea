import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleAlert,
  Clock3,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useApp } from '@/store/AppStore'
import { DEMO_MARKETS, DEMO_PLAYBOOKS } from '@/lib/demo'
import { signedMoney } from '@/lib/format'
import { todayISO } from '@/lib/dates'
import { titleFor } from '@/lib/accounts'
import type { Side, Trade } from '@/lib/types'
import { cn } from '@/lib/cn'

type Quality = 'good' | 'ok' | 'bad'

const QUALITY_VALUE: Record<Quality, number> = { good: 82, ok: 55, bad: 28 }
const QUALITY_LABEL: Record<Quality, string> = { good: 'Clean', ok: 'Average', bad: 'Sloppy' }

interface FormState {
  accountId: string
  symbol: string
  side: Side
  date: string
  qty: string
  open: string
  close: string
  entry: string
  exit: string
  pnl: string
  fees: string
  risk: string
  quality: Quality
  setup: string
  tags: string
  note: string
}

interface FormError {
  message: string
  field?: string
}

function qualityOf(trade: Trade | null): Quality {
  const value = Number(trade?.quality) || 55
  return value >= 70 ? 'good' : value >= 45 ? 'ok' : 'bad'
}

function blankForm(accountId: string): FormState {
  return {
    accountId,
    symbol: '',
    side: 'LONG',
    date: todayISO(),
    qty: '',
    open: '',
    close: '',
    entry: '',
    exit: '',
    pnl: '',
    fees: '',
    risk: '',
    quality: 'ok',
    setup: '',
    tags: '',
    note: '',
  }
}

function formFromTrade(trade: Trade, fallbackAccountId: string): FormState {
  const hhmm = (value: string | undefined) => String(value || '').slice(0, 5)
  return {
    accountId: trade.accountId || fallbackAccountId,
    symbol: trade.ticker || '',
    side: trade.side === 'SHORT' ? 'SHORT' : 'LONG',
    date: String(trade.date || todayISO()).slice(0, 10),
    qty: trade.volume ? String(trade.volume) : '',
    open: hhmm(trade.openTime),
    close: hhmm(trade.closeTime),
    entry: trade.entry ? String(trade.entry) : '',
    exit: trade.exit ? String(trade.exit) : '',
    pnl: Number.isFinite(Number(trade.pnl)) ? String(trade.pnl) : '',
    fees: trade.fees ? String(trade.fees) : '',
    risk: trade.risk ? String(trade.risk) : '',
    quality: qualityOf(trade),
    setup: trade.playbook && trade.playbook !== '—' ? trade.playbook : '',
    tags: (trade.tags || []).join(', '),
    note: trade.note || '',
  }
}

export function TradeModal() {
  const {
    tradeEditor,
    closeTradeEditor,
    accounts,
    activeAccount,
    getTradesForAccount,
    isDemo,
    saveTrade,
    deleteTrade,
    showToast,
  } = useApp()

  const editing = !!tradeEditor?.trade
  const [form, setForm] = useState<FormState>(() => blankForm(activeAccount?.id ?? accounts[0]?.id ?? ''))
  const [error, setError] = useState<FormError | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!tradeEditor) {
      setConfirmDelete(false)
      return
    }
    const fallbackId = tradeEditor.accountId || activeAccount?.id || accounts[0]?.id || ''
    setForm(tradeEditor.trade ? formFromTrade(tradeEditor.trade, fallbackId) : blankForm(fallbackId))
    setError(null)
    setConfirmDelete(false)
  }, [tradeEditor, activeAccount?.id, accounts])

  const currentAccount = accounts.find((account) => account.id === form.accountId) ?? null
  const changedAccount = accounts.find((account) => account.id === form.accountId)
  const tradePool = changedAccount ? getTradesForAccount(changedAccount) : []

  const symbolOptions = useMemo(() => {
    const values = new Set<string>()
    tradePool.forEach((trade) => {
      if (trade.ticker && trade.ticker !== '—') values.add(trade.ticker)
    })
    DEMO_MARKETS.forEach((market) => values.add(market.ticker))
    return Array.from(values).sort()
  }, [tradePool])

  const setupOptions = useMemo(() => {
    const values = new Set<string>()
    tradePool.forEach((trade) => {
      if (trade.playbook && trade.playbook !== '—') values.add(trade.playbook)
    })
    DEMO_PLAYBOOKS.forEach((playbook) => values.add(playbook))
    return Array.from(values).sort()
  }, [tradePool])

  const handleClose = useCallback(() => {
    setConfirmDelete(false)
    closeTradeEditor()
  }, [closeTradeEditor])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    if (error?.field === key) setError(null)
  }

  const showError = (next: FormError) => {
    setError(next)
    if (next.field) {
      window.setTimeout(() => {
        document.getElementById(`trade-${next.field}`)?.focus({ preventScroll: false })
      }, 25)
    }
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editing && confirmDelete) return
    const symbol = form.symbol.trim().toUpperCase()
    if (!symbol) return showError({ message: 'Enter the symbol you traded.', field: 'symbol' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      return showError({ message: 'Pick the date the trade was closed.', field: 'date' })
    }
    if (form.date > todayISO()) {
      return showError({ message: 'The trade date cannot be in the future.', field: 'date' })
    }
    const qty = Number.parseFloat(form.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return showError({ message: 'Enter a quantity greater than zero.', field: 'qty' })
    }
    const pnlText = form.pnl.trim()
    const pnl = Number.parseFloat(pnlText)
    if (pnlText === '' || !Number.isFinite(pnl)) {
      return showError({ message: 'Enter the net P&L for this trade (negative for a loss).', field: 'pnl' })
    }
    if (form.open && form.close && form.close < form.open) {
      return showError({ message: 'Close time cannot be earlier than open time.', field: 'close' })
    }
    if (!form.accountId || !accounts.some((account) => account.id === form.accountId)) {
      return showError({ message: 'Choose the account this trade belongs to.', field: 'account' })
    }

    const fees = Math.abs(Number.parseFloat(form.fees)) || 0
    const risk = Math.abs(Number.parseFloat(form.risk)) || 0
    const entry = Number.parseFloat(form.entry) || 0
    const exit = Number.parseFloat(form.exit) || 0
    const tags = Array.from(
      new Set(
        form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ).slice(0, 8)
    const roundedPnl = Math.round(pnl * 100) / 100
    const id =
      tradeEditor?.trade?.id ||
      `manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

    const trade: Trade = {
      id,
      accountId: form.accountId,
      date: form.date,
      openTime: form.open ? `${form.open}:00` : '',
      closeTime: form.close ? `${form.close}:00` : '',
      ticker: symbol,
      instrument: symbol,
      side: form.side,
      volume: qty,
      entry,
      exit,
      pnl: roundedPnl,
      gross: Math.round((pnl + fees) * 100) / 100,
      fees,
      roi: 0,
      rMultiple: risk ? roundedPnl / risk : 0,
      risk,
      playbook: form.setup.trim() || '—',
      quality: QUALITY_VALUE[form.quality],
      tags,
      note: form.note.trim(),
      manual: true,
    }

    saveTrade(trade)
    closeTradeEditor()
    showToast(
      editing ? 'Trade updated' : 'Trade added',
      `${trade.ticker} ${signedMoney(trade.pnl)}${currentAccount ? ` · ${titleFor(currentAccount)}` : ''}`,
    )
  }

  const confirmDeleteTrade = () => {
    const trade = tradeEditor?.trade
    if (!trade) return
    deleteTrade(trade.id)
    setConfirmDelete(false)
    closeTradeEditor()
    showToast('Trade deleted', `${trade.ticker} was removed from your journal.`, 'info')
  }

  return (
    <Modal
      open={!!tradeEditor}
      onClose={handleClose}
      size="lg"
      labelledBy="trade-title"
      initialFocus={editing ? '#trade-pnl' : '#trade-symbol'}
    >
      <form className="trade-form" onSubmit={submit} noValidate autoComplete="off">
        <header className="modal-head">
          <div className="modal-mark accent">
            {editing ? <PencilLine size={17} /> : <Plus size={18} />}
          </div>
          <div className="modal-head-copy">
            <span className="modal-eyebrow">{editing ? 'Trade journal' : 'New entry'}</span>
            <h2 className="modal-title" id="trade-title">
              {editing ? 'Edit trade' : 'Add trade'}
            </h2>
            <p className="modal-sub">
              {editing
                ? 'Update this manually logged trade. Changes recalculate every metric.'
                : 'Log a closed trade to the journal. Only the essentials are required.'}
            </p>
          </div>
          <ModalClose onClick={handleClose} />
        </header>

        <div className="modal-body trade-body">
          {currentAccount && isDemo(currentAccount) && !editing && (
            <div className="form-info">
              <Sparkles size={13} />
              <span>
                This account is showing sample data. Saving your first trade replaces the sample journal with your
                real entries.
              </span>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="trade-account">Account</label>
            <select
              className={cn('select', error?.field === 'account' && 'invalid')}
              id="trade-account"
              value={form.accountId}
              disabled={editing}
              onChange={(event) => update('accountId', event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {titleFor(account)} · {account.stage}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-symbol">Symbol</label>
              <input
                className={cn('input', error?.field === 'symbol' && 'invalid')}
                id="trade-symbol"
                value={form.symbol}
                onChange={(event) => update('symbol', event.target.value.toUpperCase())}
                placeholder="e.g. EURUSD, /ES, NVDA"
                maxLength={24}
                list="trade-symbols"
                spellCheck={false}
              />
              <datalist id="trade-symbols">
                {symbolOptions.map((symbol) => <option key={symbol} value={symbol} />)}
              </datalist>
            </div>
            <div className="field">
              <span className="field-label">Side</span>
              <div className="option-seg" role="group" aria-label="Trade side">
                {(['LONG', 'SHORT'] as const).map((side) => (
                  <button
                    key={side}
                    className={cn('option-seg-item', form.side === side && 'is-active', side === 'SHORT' && 'is-short')}
                    type="button"
                    aria-pressed={form.side === side}
                    onClick={() => update('side', side)}
                  >
                    {side === 'LONG' ? 'Long' : 'Short'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-date">Date</label>
              <input
                className={cn('input', error?.field === 'date' && 'invalid')}
                id="trade-date"
                type="date"
                max={todayISO()}
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trade-qty">Quantity / lots</label>
              <input
                className={cn('input', error?.field === 'qty' && 'invalid')}
                id="trade-qty"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 100 or 0.5"
                value={form.qty}
                onChange={(event) => update('qty', event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-open">
                Open time <span className="optional">Optional</span>
              </label>
              <input
                className="input"
                id="trade-open"
                type="time"
                value={form.open}
                onChange={(event) => update('open', event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trade-close">
                Close time <span className="optional">Optional</span>
              </label>
              <input
                className={cn('input', error?.field === 'close' && 'invalid')}
                id="trade-close"
                type="time"
                value={form.close}
                onChange={(event) => update('close', event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-entry">
                Entry price <span className="optional">Optional</span>
              </label>
              <input
                className="input num"
                id="trade-entry"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="0.00"
                value={form.entry}
                onChange={(event) => update('entry', event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trade-exit">
                Exit price <span className="optional">Optional</span>
              </label>
              <input
                className="input num"
                id="trade-exit"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="0.00"
                value={form.exit}
                onChange={(event) => update('exit', event.target.value)}
              />
            </div>
          </div>

          <div className="trade-section-label">
            <span>Result</span>
            <i />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-pnl">Net P&amp;L</label>
              <div className="input-wrap has-prefix">
                <span className="prefix">$</span>
                <input
                  className={cn('input num', error?.field === 'pnl' && 'invalid')}
                  id="trade-pnl"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0.00"
                  value={form.pnl}
                  onChange={(event) => update('pnl', event.target.value)}
                />
              </div>
              <span className="field-hint">Use a negative number for a loss.</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trade-fees">
                Commissions &amp; fees <span className="optional">Optional</span>
              </label>
              <div className="input-wrap has-prefix">
                <span className="prefix">$</span>
                <input
                  className="input num"
                  id="trade-fees"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={form.fees}
                  onChange={(event) => update('fees', event.target.value)}
                />
              </div>
              <span className="field-hint">Already included in net P&amp;L.</span>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-risk">
                Risk amount <span className="optional">Optional</span>
              </label>
              <div className="input-wrap has-prefix">
                <span className="prefix">$</span>
                <input
                  className="input num"
                  id="trade-risk"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Used to calculate R"
                  value={form.risk}
                  onChange={(event) => update('risk', event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <span className="field-label">Execution</span>
              <div className="option-seg three" role="group" aria-label="Execution quality">
                {(['good', 'ok', 'bad'] as const).map((quality) => (
                  <button
                    key={quality}
                    className={cn('option-seg-item', form.quality === quality && 'is-active', `is-${quality}`)}
                    type="button"
                    aria-pressed={form.quality === quality}
                    onClick={() => update('quality', quality)}
                  >
                    {QUALITY_LABEL[quality]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="trade-section-label">
            <span>Context</span>
            <i />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="trade-setup">
                Setup <span className="optional">Optional</span>
              </label>
              <input
                className="input"
                id="trade-setup"
                value={form.setup}
                onChange={(event) => update('setup', event.target.value)}
                placeholder="e.g. VWAP Reclaim"
                maxLength={48}
                list="trade-setups"
              />
              <datalist id="trade-setups">
                {setupOptions.map((setup) => <option key={setup} value={setup} />)}
              </datalist>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trade-tags">
                Tags <span className="optional">Optional</span>
              </label>
              <input
                className="input"
                id="trade-tags"
                value={form.tags}
                onChange={(event) => update('tags', event.target.value)}
                placeholder="news, revenge, A+"
                maxLength={120}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="trade-note">
              Notes <span className="optional">Optional</span>
            </label>
            <textarea
              className="textarea"
              id="trade-note"
              maxLength={600}
              placeholder="What was the plan, and how did you execute?"
              value={form.note}
              onChange={(event) => update('note', event.target.value)}
            />
          </div>

          {error && (
            <div className="form-error" role="alert">
              <CircleAlert size={13} />
              {error.message}
            </div>
          )}

          {editing && confirmDelete && (
            <div className="form-confirm">
              <div className="form-confirm-icon"><Trash2 size={15} /></div>
              <div>
                <b>Delete this trade?</b>
                <span>It will be removed from the journal and every metric recalculated. This cannot be undone.</span>
              </div>
              <div className="form-confirm-actions">
                <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmDelete(false)}>
                  Keep trade
                </Button>
                <Button variant="danger" size="sm" type="button" onClick={confirmDeleteTrade}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        <footer className="modal-foot">
          {editing && !confirmDelete && (
            <Button
              variant="danger"
              size="sm"
              type="button"
              iconLeft={<Trash2 size={13} />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <span className="spacer" />
          <span className="modal-foot-note">
            <Clock3 size={12} /> {form.date || 'No date'} · {form.side === 'LONG' ? 'Long' : 'Short'}
            {form.pnl ? ` · ${signedMoney(Number(form.pnl))}` : ''}
          </span>
          <Button variant="ghost" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {editing ? 'Save changes' : 'Save trade'}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
