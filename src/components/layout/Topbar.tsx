import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '@/store/AppStore'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { nextStageFor, titleFor } from '@/lib/accounts'
import { buildRules, computeStats, evaluateAccount, getStartingBalance } from '@/lib/stats'
import { signedMoney } from '@/lib/format'
import { readJSON, writeJSON } from '@/lib/storage'
import { cn } from '@/lib/cn'

const PAGE_META: Record<string, { title: string; group: string }> = {
  '/': { title: 'Metrics', group: 'Analytics' },
  '/metrics': { title: 'Metrics', group: 'Analytics' },
  '/journal': { title: 'Journal', group: 'Journal' },
  '/replay': { title: 'Replay', group: 'Review' },
  '/accounts': { title: 'Accounts', group: 'Workspace' },
  '/portfolio': { title: 'Accounts', group: 'Workspace' },
  '/stats': { title: 'Statistics', group: 'Analytics' },
  '/entries': { title: 'Entries', group: 'Log' },
  '/notes': { title: 'Notes', group: 'Journal' },
  '/reports': { title: 'Reports', group: 'Analytics' },
}

const READ_STORAGE_KEY = 'ta-notif-read'
const DISMISSED_STORAGE_KEY = 'ta-notif-dismissed'

type NotificationTone = 'accent' | 'pos' | 'warn' | 'neg'

interface NotificationItem {
  id: string
  accountId?: string
  accountName: string
  stage: string
  tag: string
  title: string
  detail: string
  tone: NotificationTone
  action: { type: 'route'; route: '/accounts' | '/metrics' }
  priority: number
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    accounts,
    getTradesForAccount,
    setActiveAccount,
    setCommandOpen,
  } = useApp()
  const meta = PAGE_META[location.pathname] ?? { title: 'Trader Area', group: 'Workspace' }

  const [notifOpen, setNotifOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(() => readJSON<string[]>(READ_STORAGE_KEY, []))
  const [dismissedIds, setDismissedIds] = useState<string[]>(() =>
    readJSON<string[]>(DISMISSED_STORAGE_KEY, []),
  )
  const notifRef = useRef<HTMLDivElement>(null)

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = []

    accounts.forEach((account) => {
      const starting = getStartingBalance(account)
      const trades = getTradesForAccount(account)
      const stats = computeStats(trades, starting)
      const evaluation = evaluateAccount(account, stats)
      const rulesSummary = buildRules(account, stats)
      const accountName = titleFor(account)

      if (evaluation.status === 'passed') {
        const nextStage = nextStageFor(account.type, account.stage)
        items.push({
          id: `${account.id}-passed-${account.stage}-${nextStage ?? 'funded'}`,
          accountId: account.id,
          accountName,
          stage: account.stage,
          tag: 'Ready',
          title: nextStage ? `Ready to move to ${nextStage}` : 'Funded milestone reached',
          detail: nextStage
            ? `${account.stage} target & min days met · ${signedMoney(evaluation.net, account.currency)}`
            : `Live performance target reached · ${signedMoney(evaluation.net, account.currency)}`,
          tone: 'accent',
          action: { type: 'route', route: '/accounts' },
          priority: 1,
        })
      } else if (evaluation.status === 'breached') {
        items.push({
          id: `${account.id}-breached-${account.stage}`,
          accountId: account.id,
          accountName,
          stage: account.stage,
          tag: 'Breached',
          title: `${account.stage} breached`,
          detail: evaluation.reason,
          tone: 'neg',
          action: { type: 'route', route: '/accounts' },
          priority: 2,
        })
      } else if (evaluation.targetHit && !evaluation.daysMet) {
        const remainingDays = Math.max(1, evaluation.requiredDays - stats.profitableDays)
        items.push({
          id: `${account.id}-days-${account.stage}-${remainingDays}`,
          accountId: account.id,
          accountName,
          stage: account.stage,
          tag: 'In progress',
          title: 'Profit target reached',
          detail: `${remainingDays} profitable ${remainingDays === 1 ? 'day' : 'days'} remaining in ${account.stage}`,
          tone: 'accent',
          action: { type: 'route', route: '/metrics' },
          priority: 3,
        })
      } else {
        const caution = rulesSummary.rows.find(
          (row) => row.tone === 'is-warn' || row.tone === 'is-danger',
        )
        if (caution) {
          items.push({
            id: `${account.id}-caution-${account.stage}-${caution.name}`,
            accountId: account.id,
            accountName,
            stage: account.stage,
            tag: 'Alert',
            title: `${caution.name} limit approaching`,
            detail: `${caution.value} ${caution.limit} (${caution.right} used)`,
            tone: 'warn',
            action: { type: 'route', route: '/metrics' },
            priority: 4,
          })
        }
      }
    })

    return items
      .filter((item) => !dismissedIds.includes(item.id))
      .sort((a, b) => a.priority - b.priority)
  }, [accounts, dismissedIds, getTradesForAccount])

  const readSet = useMemo(() => new Set(readIds), [readIds])
  const unreadCount = useMemo(
    () => notifications.filter((item) => !readSet.has(item.id)).length,
    [notifications, readSet],
  )
  const hasUrgentUnread = useMemo(
    () =>
      notifications.some(
        (item) => !readSet.has(item.id) && (item.tone === 'neg' || item.tone === 'warn'),
      ),
    [notifications, readSet],
  )

  useEffect(() => {
    setNotifOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!notifOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!notifRef.current?.contains(event.target as Node)) setNotifOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [notifOpen])

  const markRead = (id: string) => {
    setReadIds((previous) => {
      if (previous.includes(id)) return previous
      const next = [...previous, id]
      writeJSON(READ_STORAGE_KEY, next)
      return next
    })
  }

  const markAllRead = () => {
    const next = Array.from(new Set([...readIds, ...notifications.map((item) => item.id)]))
    setReadIds(next)
    writeJSON(READ_STORAGE_KEY, next)
  }

  const clearAll = () => {
    const next = Array.from(new Set([...dismissedIds, ...notifications.map((item) => item.id)]))
    setDismissedIds(next)
    writeJSON(DISMISSED_STORAGE_KEY, next)
  }

  const handleSelectItem = (item: NotificationItem) => {
    markRead(item.id)
    setNotifOpen(false)
    if (item.accountId) setActiveAccount(item.accountId)
    navigate(item.action.route)
  }

  return (
    <header className="topbar">
      <button className="icon-btn mobile-menu" type="button" onClick={onOpenMobile} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <div className="topbar-title">
        <b>{meta.title}</b>
      </div>
      <div className="topbar-right">
        <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
          <Search size={15} strokeWidth={1.8} />
          <span>Search anything…</span>
          <kbd>⌘K</kbd>
        </button>
        <ThemeToggle />
        <div className="notif-wrap" ref={notifRef}>
          <button
            className={cn('icon-btn notif-trigger', notifOpen && 'is-open')}
            type="button"
            title="Notifications"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((open) => !open)}
          >
            <Bell size={16} strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className={cn('dot', hasUrgentUnread && 'is-alert')} aria-hidden="true" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                className="notif-menu"
                role="menu"
                aria-label="Notifications"
                initial={{ opacity: 0, y: 6, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.985 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="notif-menu-head">
                  <div className="notif-menu-title">
                    <b>Notifications</b>
                    {unreadCount > 0 && <span className="notif-count-badge num">{unreadCount}</span>}
                  </div>
                  {notifications.length > 0 && (
                    <div className="notif-head-actions">
                      {unreadCount > 0 && (
                        <button className="notif-action-link" type="button" onClick={markAllRead}>
                          Mark all read
                        </button>
                      )}
                      <button className="notif-action-link is-muted" type="button" onClick={clearAll}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <b>All caught up</b>
                    <span>Rule and milestone alerts will appear here.</span>
                  </div>
                ) : (
                  <div className="notif-list">
                    {notifications.map((item) => {
                      const unread = !readSet.has(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          className={cn('notif-item', `tone-${item.tone}`, unread && 'is-unread')}
                          onClick={() => handleSelectItem(item)}
                        >
                          <span className="notif-item-bar" aria-hidden="true" />
                          <span className="notif-item-copy">
                            <span className="notif-item-top">
                              <strong>{item.accountName}</strong>
                              <span className="notif-item-stage">{item.stage}</span>
                              <span className={cn('notif-item-tag', `tone-${item.tone}`)}>
                                {item.tag}
                              </span>
                              {unread && <i className="notif-unread-dot" aria-label="Unread" />}
                            </span>
                            <span className="notif-item-headline">{item.title}</span>
                            <span className="notif-item-detail">{item.detail}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
