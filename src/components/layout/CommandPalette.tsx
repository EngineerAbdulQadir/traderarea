import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  CalendarDays,
  FileBarChart,
  ListOrdered,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wallet,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useApp } from '@/store/AppStore'
import { useTheme } from '@/hooks/useTheme'
import { accountBadge, accountGradient, titleFor } from '@/lib/accounts'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { cn } from '@/lib/cn'

interface CommandItem {
  id: string
  label: string
  hint?: string
  group: string
  icon: ReactNode
  run: () => void
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, accounts, setActiveAccount, openChallenge, openTradeEditor, openSettings } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      setActiveIndex(0)
      const timer = window.setTimeout(() => inputRef.current?.focus(), 70)
      return () => window.clearTimeout(timer)
    }
  }, [commandOpen])

  const items = useMemo<CommandItem[]>(() => {
    const closeAnd = (action: () => void) => () => {
      setCommandOpen(false)
      window.setTimeout(action, 90)
    }

    const pages: CommandItem[] = [
      { id: 'page-metrics', label: 'Metrics', hint: 'Performance & KPI dashboard', group: 'Navigate', icon: <BarChart3 size={15} />, run: closeAnd(() => navigate('/metrics')) },
      { id: 'page-journal', label: 'Journal', hint: 'Session calendar & reflections', group: 'Navigate', icon: <CalendarDays size={15} />, run: closeAnd(() => navigate('/journal')) },
      { id: 'page-accounts', label: 'Portfolio', hint: 'Challenges and phases', group: 'Navigate', icon: <Wallet size={15} />, run: closeAnd(() => navigate('/portfolio')) },
      { id: 'page-stats', label: 'Stats', hint: 'Timing, markets, behaviour', group: 'Navigate', icon: <BarChart3 size={15} />, run: closeAnd(() => navigate('/stats')) },
      { id: 'page-entries', label: 'Entries', hint: 'Every trade in the journal', group: 'Navigate', icon: <ListOrdered size={15} />, run: closeAnd(() => navigate('/entries')) },
      { id: 'page-notes', label: 'Notes', hint: 'Daily session reflections', group: 'Navigate', icon: <BookOpenText size={15} />, run: closeAnd(() => navigate('/notes')) },
      { id: 'page-reports', label: 'Reports', hint: 'Where your edge lives', group: 'Navigate', icon: <FileBarChart size={15} />, run: closeAnd(() => navigate('/reports')) },
      { id: 'action-settings', label: 'Open settings', hint: 'Profile, appearance and data', group: 'Actions', icon: <Settings size={15} />, run: closeAnd(openSettings) },
    ]

    const actions: CommandItem[] = [
      { id: 'action-challenge', label: 'Start a new challenge', hint: 'Open the challenge builder', group: 'Actions', icon: <Plus size={15} />, run: closeAnd(openChallenge) },
      { id: 'action-trade', label: 'Log a trade', hint: 'Add a closed trade to the journal', group: 'Actions', icon: <Sparkles size={15} />, run: closeAnd(() => openTradeEditor()) },
      {
        id: 'action-theme',
        label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        hint: 'Change the dashboard appearance',
        group: 'Actions',
        icon: isDark ? <Sun size={15} /> : <Moon size={15} />,
        run: closeAnd(toggleTheme),
      },
    ]

    const accountItems: CommandItem[] = accounts.map((account) => ({
      id: `account-${account.id}`,
      label: titleFor(account),
      hint: `${account.stage} · ${account.platform} · ${account.firm}`,
      group: 'Switch account',
      icon: <AccountAvatar badge={accountBadge(account)} gradient={accountGradient(account)} size="xs" />,
      run: closeAnd(() => setActiveAccount(account.id)),
    }))

    const q = query.trim().toLowerCase()
    const all = [...pages, ...actions, ...accountItems]
    if (!q) return all
    return all.filter((item) => `${item.label} ${item.hint ?? ''} ${item.group}`.toLowerCase().includes(q))
  }, [accounts, navigate, openChallenge, openTradeEditor, openSettings, query, setActiveAccount, setCommandOpen, isDark, toggleTheme])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    items.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)?.push(item)
    })
    return Array.from(map.entries())
  }, [items])

  const flat = groups.flatMap(([, groupItems]) => groupItems)

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(flat.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      flat[activeIndex]?.run()
    }
  }

  let runningIndex = -1

  return (
    <Modal
      open={commandOpen}
      onClose={() => setCommandOpen(false)}
      size="md"
      align="top"
      className="command-modal"
      initialFocus="input"
    >
      <div className="command-search">
        <Search size={16} />
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Search pages, accounts or actions…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Command search"
        />
        <kbd>esc</kbd>
      </div>
      <div className="command-list" ref={listRef}>
        {groups.length === 0 && (
          <div className="command-empty">
            <Search size={18} />
            <b>No matches</b>
            <span>Try a page name, account or action.</span>
          </div>
        )}
        {groups.map(([group, groupItems]) => (
          <div className="command-group" key={group}>
            <div className="command-group-label">{group}</div>
            {groupItems.map((item) => {
              runningIndex += 1
              const index = runningIndex
              return (
                <button
                  key={item.id}
                  data-index={index}
                  type="button"
                  className={cn('command-item', index === activeIndex && 'is-active')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={item.run}
                >
                  <span className="command-item-icon">{item.icon}</span>
                  <span className="command-item-copy">
                    <b>{item.label}</b>
                    {item.hint && <span>{item.hint}</span>}
                  </span>
                  <ArrowRight size={13} className="command-item-arrow" />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="command-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to navigate
        </span>
        <span>
          <kbd>↵</kbd> to open
        </span>
        <span className="command-footer-brand">Trader Area</span>
      </div>
    </Modal>
  )
}
