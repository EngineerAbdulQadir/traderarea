import { Bell, Menu, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useApp } from '@/store/AppStore'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const PAGE_META: Record<string, { title: string; group: string }> = {
  '/': { title: 'Metrics', group: 'Analytics' },
  '/metrics': { title: 'Metrics', group: 'Analytics' },
  '/journal': { title: 'Journal', group: 'Journal' },
  '/accounts': { title: 'Portfolio', group: 'Workspace' },
  '/stats': { title: 'Statistics', group: 'Analytics' },
  '/entries': { title: 'Entries', group: 'Log' },
  '/notes': { title: 'Notes', group: 'Journal' },
  '/reports': { title: 'Reports', group: 'Analytics' },
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation()
  const { setCommandOpen, showToast } = useApp()
  const meta = PAGE_META[location.pathname] ?? { title: 'Trader Area', group: 'Workspace' }

  return (
    <header className="topbar">
      <button className="icon-btn mobile-menu" type="button" onClick={onOpenMobile} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <div className="topbar-title">
        <b>{meta.title}</b>
        <span>{meta.group}</span>
      </div>
      <div className="topbar-right">
        <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
          <Search size={13} />
          <span>Search anything…</span>
          <kbd>⌘K</kbd>
        </button>
        <ThemeToggle />
        <button
          className="icon-btn"
          type="button"
          title="Notifications"
          onClick={() => showToast('You are all caught up', 'No new account alerts or rule warnings.', 'info')}
        >
          <Bell size={16} strokeWidth={1.8} />
          <span className="dot" />
        </button>
        <div className="topbar-divider" />
        <button
          className="topbar-avatar"
          type="button"
          title="Alex M."
          onClick={() => showToast('Local workspace', 'Trader Area keeps all journal data on this device.', 'info')}
        >
          AX
        </button>
      </div>
    </header>
  )
}
