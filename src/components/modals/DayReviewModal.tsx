import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  ImagePlus,
  Maximize2,
  PencilLine,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useApp } from '@/store/AppStore'
import { IntradayCurve } from '@/components/charts/IntradayCurve'
import { buildIntradaySeries, computeStats, getStartingBalance } from '@/lib/stats'
import { formatLongDate, formatNumericDate, dayName } from '@/lib/dates'
import { formatPrice, formatR, plainPercent, signedMoney } from '@/lib/format'
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
  const [images, setImages] = useState<string[]>([])
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [hoverTradeId, setHoverTradeId] = useState<string | null>(null)
  const [confirmNoteDelete, setConfirmNoteDelete] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync state when dayReview or note changes
  useEffect(() => {
    if (!dayReview) return
    setEditing(!!dayReview.editNote)
    const n = activeNotes[dayReview.date]
    setDraft(n?.text ?? '')
    setImages(n?.images ?? [])
    setConfirmNoteDelete(false)
    setHoverTradeId(null)
    setZoomImage(null)
  }, [dayReview, activeNotes])

  // Esc key for Lightbox zoom preview
  useEffect(() => {
    if (!dayReview) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (zoomImage && e.key === 'Escape') {
        setZoomImage(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dayReview, zoomImage])

  // Auto focus textarea when entering editing mode
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

  // Process & compress screenshot attachments (max 1200px, 82% quality)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Invalid file', 'Please select an image file (PNG, JPG, WebP).', 'info')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      if (!src) return

      const img = new Image()
      img.onload = () => {
        const MAX_DIM = 1200
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82)
        setImages((prev) => {
          const updated = [...prev, compressed]
          if (!editing && activeAccount && dayReview) {
            saveNote(activeAccount.id, dayReview.date, draft, updated)
          }
          return updated
        })
        showToast('Chart attached', 'Screenshot added to this session note.', 'success')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  // Clipboard paste listener: ⌘V / Ctrl+V to attach screenshots instantly
  useEffect(() => {
    if (!dayReview) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            processImageFile(file)
            break
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [dayReview, editing, activeAccount, draft, saveNote, showToast])

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
    setImages(note?.images ?? [])
    setEditing(true)
    setConfirmNoteDelete(false)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(note?.text ?? '')
    setImages(note?.images ?? [])
    setConfirmNoteDelete(false)
  }

  const saveCurrentNote = () => {
    if (!dayReview || !activeAccount) return
    const text = draft.trim()
    saveNote(activeAccount.id, dayReview.date, text, images)
    setEditing(false)
    setConfirmNoteDelete(false)
    showToast(
      text || images.length ? 'Note saved' : 'Note cleared',
      text || images.length
        ? `Journal entry updated for ${formatLongDate(dayReview.date)}.`
        : 'The journal entry was removed from this session.',
      text || images.length ? 'success' : 'info',
    )
  }

  const deleteCurrentNote = () => {
    if (!dayReview || !activeAccount) return
    saveNote(activeAccount.id, dayReview.date, '', [])
    setDraft('')
    setImages([])
    setEditing(false)
    setConfirmNoteDelete(false)
    showToast('Note deleted', `The note for ${formatLongDate(dayReview.date)} was removed.`, 'info')
  }

  const removeImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove)
    setImages(updated)
    if (!editing && activeAccount && dayReview) {
      saveNote(activeAccount.id, dayReview.date, draft, updated)
    }
  }

  const editTrade = (tradeId: string) => {
    const trade = activeTrades.find((candidate) => candidate.id === tradeId) || dayTrades.find((item) => item.id === tradeId)
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

  const hasNoteContent = (note?.text && note.text.trim().length > 0) || (note?.images && note.images.length > 0)

  return (
    <>
      <Modal
        open={!!dayReview}
        onClose={closeDayReview}
        size="xl"
        labelledBy="day-review-title"
        className="day-modal"
        initialFocus={dayReview?.editNote ? '#day-note-input' : undefined}
      >
        {/* Sleek, Clean Modal Header */}
        <header className="modal-head day-modal-head">
          <div className="modal-mark accent"><CalendarDays size={18} /></div>
          <div className="modal-head-copy">
            <span className="modal-eyebrow day-eyebrow">{date ? dayName(date) : 'Day review'}</span>
            <h2 className="modal-title" id="day-review-title">
              {date ? formatNumericDate(date) : 'Day review'}
            </h2>
            <p className="modal-sub">
              {date === new Date().toISOString().slice(0, 10)
                ? 'Today’s execution, notes and trade detail.'
                : 'A session in review — curve, results and the note you left behind.'}
            </p>
          </div>
          <div className="day-head-actions">
            <span className={cn('day-net num', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>
              {dayTrades.length ? signedMoney(stats.net) : '—'}
            </span>
            <ModalClose onClick={closeDayReview} />
          </div>
        </header>

        <div className="day-modal-scroll">
          {/* Hidden file input for screenshot attachments */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload chart screenshot"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) processImageFile(file)
              e.target.value = ''
            }}
          />

          {/* Clean Modern Daily Note Section */}
          {editing ? (
            <section className="day-note is-editing">
              <div className="day-note-head">
                <span><PenLine size={12} /> Note</span>
                {note && <time>{noteSavedLabel(note.updatedAt)}</time>}
              </div>
              <textarea
                ref={textareaRef}
                className="textarea day-note-input"
                id="day-note-input"
                aria-label="Journal note"
                maxLength={2400}
                placeholder="What did you see? What did you execute well? Paste chart screenshots (⌘V) or record your key lessons..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    saveCurrentNote()
                  }
                }}
              />

              {/* Image previews inside editor */}
              {images.length > 0 && (
                <div className="day-note-images">
                  {images.map((img, idx) => (
                    <div key={idx} className="day-note-img-thumb" onClick={() => setZoomImage(img)}>
                      <img src={img} alt={`Chart screenshot ${idx + 1}`} />
                      <div className="day-note-img-overlay">
                        <span className="day-note-img-zoom" title="View full size">
                          <Maximize2 size={12} />
                        </span>
                        <button
                          type="button"
                          className="day-note-img-remove"
                          title="Remove screenshot"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(idx)
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="day-note-foot">
                <span className="day-note-hint">
                  Press <b>⌘V</b> anywhere to paste chart screenshot · ⌘ + Enter to save
                </span>
                <div className="day-note-btn-group">
                  <button
                    type="button"
                    className="day-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus size={12} />
                    <span>Attach chart</span>
                  </button>
                  {hasNoteContent && (
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
                    <b>Delete this note?</b>
                    <span>The notes and attached screenshots for this session will be removed.</span>
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
          ) : hasNoteContent ? (
            <section className="day-note">
              <div className="day-note-head">
                <span><PenLine size={12} /> Note</span>
                <div className="day-note-actions">
                  {note?.seeded && <Badge tone="violet">Sample</Badge>}
                  {note?.updatedAt && <time>{noteSavedLabel(note.updatedAt)}</time>}
                  <button
                    type="button"
                    className="day-attach-btn-compact"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach chart screenshot (or press ⌘V)"
                  >
                    <ImagePlus size={12} />
                    <span>Attach</span>
                  </button>
                  <button type="button" onClick={startEdit}>Edit</button>
                  <button className="is-danger" type="button" onClick={() => setConfirmNoteDelete(true)}>Delete</button>
                </div>
              </div>

              {note?.text && <p className="day-note-text">{note.text}</p>}

              {/* Attached Chart Screenshots Gallery */}
              {images.length > 0 && (
                <div className="day-note-images">
                  {images.map((img, idx) => (
                    <div key={idx} className="day-note-img-thumb" onClick={() => setZoomImage(img)}>
                      <img src={img} alt={`Chart screenshot ${idx + 1}`} />
                      <div className="day-note-img-overlay">
                        <span className="day-note-img-zoom" title="View full size">
                          <Maximize2 size={12} />
                        </span>
                        <button
                          type="button"
                          className="day-note-img-remove"
                          title="Remove screenshot"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(idx)
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {confirmNoteDelete && (
                <div className="form-confirm compact">
                  <div className="form-confirm-icon"><Trash2 size={14} /></div>
                  <div>
                    <b>Delete this note?</b>
                    <span>The notes and attached screenshots for this session will be removed.</span>
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
            <div className="day-note-empty-card" onClick={startEdit}>
              <div className="day-note-empty-left">
                <span className="day-note-empty-icon"><PenLine size={15} /></span>
                <div>
                  <b>Add session note &amp; chart screenshots</b>
                  <p>Record your execution plan, mistakes and market context. Press ⌘V to paste screenshots.</p>
                </div>
              </div>
              <div className="day-note-empty-right">
                <button
                  type="button"
                  className="day-note-add-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit()
                  }}
                >
                  <Plus size={12} />
                  <span>Write note</span>
                </button>
                <button
                  type="button"
                  className="day-note-attach-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title="Attach chart screenshot"
                >
                  <ImagePlus size={12} />
                  <span>Attach chart</span>
                </button>
              </div>
            </div>
          )}

          {/* Performance Overview: Intraday Curve & 2x4 Stats Grid */}
          <div className="dm-overview">
            <section className="day-curve">
              <div className="day-section-head">
                <span>Intraday cumulative P&amp;L</span>
                {dayTrades.length > 0 && (
                  <span className={cn('num', stats.net >= 0 ? 'is-pos' : 'is-neg')}>
                    {signedMoney(stats.net)}
                  </span>
                )}
              </div>
              {dayTrades.length > 0 ? (
                <IntradayCurve
                  points={intraday}
                  height={168}
                  highlightTradeId={hoverTradeId}
                  onHoverTrade={setHoverTradeId}
                />
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

          {/* Session Ledger Header */}
          <div className="day-trades-head">
            <div className="day-trades-title">
              <span className="card-kicker"><i className="dot" /> Session ledger</span>
              <h3>{dayTrades.length} Trade{dayTrades.length === 1 ? '' : 's'} recorded</h3>
            </div>
            <div className="day-trades-actions">
              <span className="day-trades-hint">
                Hover trade to highlight on curve · Click row to edit
              </span>
              <button
                type="button"
                className="day-trades-add-btn"
                onClick={() => {
                  closeDayReview()
                  openTradeEditor()
                }}
              >
                <Plus size={12} />
                <span>Log trade</span>
              </button>
            </div>
          </div>

          {/* Trades Table */}
          {dayTrades.length ? (
            <div className="table-wrap day-table-wrap">
              <table className="data-table day-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="r">Qty</th>
                    <th className="r">Entry</th>
                    <th className="r">Exit</th>
                    <th className="r">Net P&amp;L</th>
                    <th className="r">R</th>
                    <th>Quality</th>
                    <th className="r">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dayTrades.map((trade) => {
                    const r = Number(trade.rMultiple) || 0
                    const grade = tradeGrade(trade)
                    const isHovered = hoverTradeId === trade.id
                    return (
                      <tr
                        key={trade.id}
                        className={cn('day-table-row', isHovered && 'is-active-hover')}
                        onMouseEnter={() => setHoverTradeId(trade.id)}
                        onMouseLeave={() => setHoverTradeId(null)}
                        onClick={() => editTrade(trade.id)}
                        title={`Click to edit ${trade.ticker} trade`}
                      >
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
                        <td className="r" onClick={(event) => event.stopPropagation()}>
                          <button
                            className="day-trade-edit-btn"
                            type="button"
                            title={`Edit ${trade.ticker} trade`}
                            aria-label={`Edit ${trade.ticker} trade`}
                            onClick={() => editTrade(trade.id)}
                          >
                            <PencilLine size={12} />
                            <span>Edit</span>
                          </button>
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
                <p>Use the note or chart attachment to capture your session watchlist or lessons.</p>
              </div>
            </div>
          )}

          {/* Modal Footer */}
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

      {/* Lightbox / Zoom View for Chart Screenshots */}
      {zoomImage && (
        <div className="day-img-lightbox" onClick={() => setZoomImage(null)}>
          <div className="day-img-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={zoomImage} alt="Chart execution screenshot" className="day-img-lightbox-img" />
            <div className="day-img-lightbox-bar">
              <span>Chart screenshot preview</span>
              <button
                type="button"
                className="day-img-lightbox-close"
                onClick={() => setZoomImage(null)}
                title="Close preview (Esc)"
              >
                <X size={15} />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
