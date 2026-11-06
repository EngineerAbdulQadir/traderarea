import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  Clock3,
  PencilLine,
  PenLine,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useApp } from '@/store/AppStore'
import { IntradayCurve } from '@/components/charts/IntradayCurve'
import { buildIntradaySeries, computeStats, getStartingBalance } from '@/lib/stats'
import { formatLongDate, formatNumericDate, dayName } from '@/lib/dates'
import { formatPrice, formatR, formatTime, plainPercent, signedMoney } from '@/lib/format'
import { noteSavedLabel } from '@/lib/notes'
import { tradeGrade } from '@/lib/trades'
import { cn } from '@/lib/cn'

export function DayReviewModal() {
  const {
    dayReview,
    closeDayReview,
    activeAccount,
    activeTrades,
    activeNotes,
    saveNote,
    openTradeEditor,
    showToast,
  } = useApp()

  const date = dayReview?.date ?? ''
  const note = date ? activeNotes[date] : undefined
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirmNoteDelete, setConfirmNoteDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!dayReview) return
    setEditing(!!dayReview.editNote)
    setDraft(activeNotes[dayReview.date]?.text ?? '')
    setConfirmNoteDelete(false)
  }, [dayReview])

  useEffect(() => {
    if (!editing) return
    const timer = window.setTimeout(() => {
      const input = textareaRef.current
      if (!input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(input.value.length, input.value.length)
    }, 90)
    return () => window.clearTimeout(timer)
  }, [editing])

  const dayTrades = activeTrades
    .filter((trade) => trade.date === date)
    .slice()
    .sort((a, b) => (a.openTime || '').localeCompare(b.openTime || ''))
  const stats = computeStats(dayTrades, getStartingBalance(activeAccount))
  const intraday = buildIntradaySeries(dayTrades)
  const bestTrade = dayTrades.length
    ? dayTrades.reduce((best, trade) => (trade.pnl > best.pnl ? trade : best))
    : null
  const worstTrade = dayTrades.length
    ? dayTrades.reduce((worst, trade) => (trade.pnl < worst.pnl ? trade : worst))
    : null

  const startEdit = () => {
    setDraft(note?.text ?? '')
    setEditing(true)
    setConfirmNoteDelete(false)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(note?.text ?? '')
    setConfirmNoteDelete(false)
  }

  const saveCurrentNote = () => {
    if (!dayReview || !activeAccount) return
    const text = draft.trim()
    saveNote(activeAccount.id, dayReview.date, text)
    setEditing(false)
    setConfirmNoteDelete(false)
    showToast(
      text ? 'Note saved' : 'Note cleared',
      text
        ? `Journal entry updated for ${formatLongDate(dayReview.date)}.`
        : 'The journal entry was removed from this session.',
      text ? 'success' : 'info',
    )
  }

  const deleteCurrentNote = () => {
    if (!dayReview || !activeAccount) return
    saveNote(activeAccount.id, dayReview.date, '')
    setDraft('')
    setEditing(false)
    setConfirmNoteDelete(false)
    showToast('Note deleted', `The reflection for ${formatLongDate(dayReview.date)} was removed.`, 'info')
  }

  const editTrade = (tradeId: string) => {
    const trade = dayTrades.find((item) => item.id === tradeId)
    if (!trade) return
    closeDayReview()
    openTradeEditor({ trade })
  }

  const statRows: { label: string; value: string; tone?: string }[] = [
    { label: 'Net P&L', value: signedMoney(stats.net), tone: stats.net > 0 ? 'is-pos' : stats.net < 0 ? 'is-neg' : '' },
    { label: 'Trades', value: String(stats.count) },
    { label: 'Win rate', value: `${plainPercent(stats.winRate)}%` },
    { label: 'Profit factor', value: stats.grossLoss ? stats.pf.toFixed(2) : stats.grossProfit ? '∞' : '—' },
    { label: 'Avg win', value: stats.avgWin ? signedMoney(stats.avgWin) : '—', tone: stats.avgWin ? 'is-pos' : '' },
    { label: 'Avg loss', value: stats.avgLoss ? signedMoney(-stats.avgLoss) : '—', tone: stats.avgLoss ? 'is-neg' : '' },
    { label: 'Best trade', value: bestTrade ? signedMoney(bestTrade.pnl) : '—', tone: bestTrade && bestTrade.pnl > 0 ? 'is-pos' : '' },
    { label: 'Worst trade', value: worstTrade ? signedMoney(worstTrade.pnl) : '—', tone: worstTrade && worstTrade.pnl < 0 ? 'is-neg' : '' },
  ]

  return (
    <Modal
      open={!!dayReview}
      onClose={closeDayReview}
      size="xl"
      labelledBy="day-review-title"
      className="day-modal"
      initialFocus={dayReview?.editNote ? '#day-note-input' : undefined}
    >
      <header className="modal-head day-modal-head">
        <div className="modal-mark accent"><CalendarDays size={18} /></div>
        <div className="modal-head-copy">
          <span className="modal-eyebrow day-eyebrow">{date ? dayName(date) : 'Day review'}</span>
          <h2 className="modal-title" id="day-review-title">
            {date ? formatNumericDate(date) : 'Day review'}
          </h2>
          <p className="modal-sub">
            {date === new Date().toISOString().slice(0, 10)
              ? 'Today’s execution, reflections and trade detail.'
              : 'A session in review — curve, results and the note you left behind.'}
          </p>
        </div>
        <div className="day-head-actions">
          <span className={cn('day-net num', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>
            {dayTrades.length ? signedMoney(stats.net) : '—'}
          </span>
          <button className="dm-note-btn" type="button" onClick={editing ? cancelEdit : startEdit}>
            <PenLine size={13} />
            <span>{editing ? 'Close editor' : note ? 'Edit note' : 'Add note'}</span>
          </button>
          <ModalClose onClick={closeDayReview} />
        </div>
      </header>

      <div className="day-modal-scroll">
        {editing ? (
          <section className="day-note is-editing">
            <div className="day-note-head">
              <span><PenLine size={12} /> Journal note</span>
              {note && <time>{noteSavedLabel(note.updatedAt)}</time>}
            </div>
            <textarea
              ref={textareaRef}
              className="textarea day-note-input"
              id="day-note-input"
              aria-label="Journal note"
              maxLength={2400}
              placeholder="What did you see? What did you execute well? What will you repeat tomorrow?"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  saveCurrentNote()
                }
              }}
            />
            <div className="day-note-foot">
              <span>⌘ + Enter to save</span>
              <div>
                {note && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmNoteDelete(true)}>
                    Delete
                  </Button>
                )}
                <Button variant="ghost" size="sm" type="button" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="button" onClick={saveCurrentNote}>
                  Save note
                </Button>
              </div>
            </div>
            {confirmNoteDelete && (
              <div className="form-confirm compact">
                <div className="form-confirm-icon"><Trash2 size={14} /></div>
                <div>
                  <b>Delete this journal note?</b>
                  <span>The reflection for this session will be removed. This cannot be undone.</span>
                </div>
                <div className="form-confirm-actions">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmNoteDelete(false)}>
                    Keep
                  </Button>
                  <Button variant="danger" size="sm" type="button" onClick={deleteCurrentNote}>
                    Delete note
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : note ? (
          <section className="day-note">
            <div className="day-note-head">
              <span><PenLine size={12} /> Journal note</span>
              <div className="day-note-actions">
                {note.seeded && <Badge tone="violet">Sample</Badge>}
                {note.updatedAt && <time>{noteSavedLabel(note.updatedAt)}</time>}
                <button type="button" onClick={startEdit}>Edit</button>
                <button className="is-danger" type="button" onClick={() => setConfirmNoteDelete(true)}>Delete</button>
              </div>
            </div>
            <p>{note.text}</p>
            {confirmNoteDelete && (
              <div className="form-confirm compact">
                <div className="form-confirm-icon"><Trash2 size={14} /></div>
                <div>
                  <b>Delete this journal note?</b>
                  <span>The reflection for this session will be removed. This cannot be undone.</span>
                </div>
                <div className="form-confirm-actions">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmNoteDelete(false)}>
                    Keep
                  </Button>
                  <Button variant="danger" size="sm" type="button" onClick={deleteCurrentNote}>
                    Delete note
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <button className="day-note-empty" type="button" onClick={startEdit}>
            <span className="day-note-empty-icon"><PenLine size={16} /></span>
            <span>
              <b>Leave a note for this session</b>
              <span>Capture the plan, the execution and the lesson while the market is still fresh.</span>
            </span>
            <span className="day-note-empty-action">Write note</span>
          </button>
        )}

        <div className="dm-overview">
          <section className="day-curve">
            <div className="day-section-head">
              <span>Intraday cumulative</span>
              {dayTrades.length > 0 && (
                <span className={cn('num', stats.net >= 0 ? 'is-pos' : 'is-neg')}>
                  {signedMoney(stats.net)}
                </span>
              )}
            </div>
            {dayTrades.length > 0 ? (
              <IntradayCurve points={intraday} height={168} />
            ) : (
              <div className="day-curve-empty">
                <Clock3 size={16} />
                <span>No trades recorded for this session</span>
              </div>
            )}
          </section>

          <section className="dm-stats">
            {statRows.map((row) => (
              <div className="dm-stat" key={row.label}>
                <span>{row.label}</span>
                <b className={cn('num', row.tone)}>{row.value}</b>
              </div>
            ))}
          </section>
        </div>

        <div className="day-trades-head">
          <div>
            <span className="card-kicker"><i className="dot" /> Session ledger</span>
            <h3>Trades</h3>
          </div>
          <span>
            {dayTrades.length} closed trade{dayTrades.length === 1 ? '' : 's'}
          </span>
        </div>

        {dayTrades.length ? (
          <div className="table-wrap day-table-wrap">
            <table className="data-table day-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th className="r">Qty</th>
                  <th className="r">Entry</th>
                  <th className="r">Exit</th>
                  <th className="r">Net P&amp;L</th>
                  <th className="r">R</th>
                  <th>Quality</th>
                  <th className="r"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {dayTrades.map((trade) => {
                  const r = Number(trade.rMultiple) || 0
                  const grade = tradeGrade(trade)
                  return (
                    <tr key={trade.id}>
                      <td>
                        <span className="entry-date">{formatTime(trade.openTime)}</span>
                        <small>{trade.closeTime ? `${formatTime(trade.closeTime)} close` : '—'}</small>
                      </td>
                      <td>
                        <b className="t-sym">{trade.ticker}</b>
                        <small>{trade.playbook}</small>
                      </td>
                      <td>
                        <span className={cn('side-pill', trade.side === 'LONG' ? 'is-long' : 'is-short')}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="r num">{Number(trade.volume).toLocaleString('en-US')}</td>
                      <td className="r num">{formatPrice(trade.entry)}</td>
                      <td className="r num">{formatPrice(trade.exit)}</td>
                      <td className={cn('r num entry-pnl', trade.pnl > 0 && 'is-pos', trade.pnl < 0 && 'is-neg')}>
                        <b>{signedMoney(trade.pnl)}</b>
                      </td>
                      <td className={cn('r num', r > 0 && 'is-pos', r < 0 && 'is-neg')}>{formatR(r)}</td>
                      <td>
                        <span className={`exec-tag is-${grade.key}`}>{grade.label}</span>
                      </td>
                      <td className="r">
                        {trade.manual ? (
                          <button
                            className="entry-edit"
                            type="button"
                            title="Edit trade"
                            aria-label={`Edit ${trade.ticker} trade`}
                            onClick={() => editTrade(trade.id)}
                          >
                            <PencilLine size={13} />
                          </button>
                        ) : (
                          <span className="entry-open"><Check size={12} /></span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="day-empty">
            <span className="day-empty-icon"><Sparkles size={19} /></span>
            <div>
              <b>No trades on this day</b>
              <p>Use the note to capture the session, your watchlist or a lesson from the market.</p>
            </div>
          </div>
        )}

        <div className="day-foot">
          <span>
            {stats.count > 0 ? (
              <>
                {stats.greenDays ? <TrendingUp size={12} className="is-pos" /> : <TrendingDown size={12} className="is-neg" />}
                {' '}Times shown in your local timezone · P&amp;L is net of fees.
              </>
            ) : (
              'A quiet day is still part of the process.'
            )}
          </span>
          <Button variant="ghost" size="sm" type="button" onClick={closeDayReview}>
            Close review
          </Button>
        </div>
      </div>
    </Modal>
  )
}
