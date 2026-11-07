import { Bell, LogOut, Menu, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
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
  const navigate = useNavigate()
  const { setCommandOpen, showToast } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])
  const meta = PAGE_META[location.pathname] ?? { title: 'Trader Area', group: 'Workspace' }

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
        <div className="topbar-user" ref={menuRef}>
          <button
            className="topbar-avatar"
            type="button"
            title="Alex M."
            onClick={() => setMenuOpen((v) => !v)}
          >
            AX
          </button>
          {menuOpen && (
            <div className="topbar-user-menu">
              <div className="menu-profile">
                <div className="menu-avatar">AX</div>
                <div className="menu-info">
                  <b>Alex M.</b>
                  <span>alex@traderarea.local</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/auth')
                }}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
