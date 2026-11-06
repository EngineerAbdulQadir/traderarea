import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Layers,
  NotebookPen,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
  Check,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '@/store/AppStore'
import { accountBadge, accountGradient, titleFor } from '@/lib/accounts'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { accounts, activeAccount, setActiveAccount, openChallenge } = useApp()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 900px)')

  useEffect(() => {
    setSwitcherOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!switcherOpen) return
    const onClick = (event: MouseEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) setSwitcherOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [switcherOpen])

  const handleCollapse = () => {
    if (isMobile) onCloseMobile()
    else onToggleCollapsed()
  }

  return (
    <>
      <aside className={cn('sidebar', mobileOpen && 'mobile-open')} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <img src="/logo-theme.png" alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <span className="brand-name">Trader Area</span>
            <span className="brand-sub">Performance OS</span>
          </div>
          <div className="brand-actions">
            <button
              className="collapse-btn"
              type="button"
              onClick={handleCollapse}
              title={isMobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isMobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isMobile ? (
                <X size={14} />
              ) : collapsed ? (
                <PanelLeftOpen size={14} />
              ) : (
                <PanelLeftClose size={14} />
              )}
            </button>
          </div>
        </div>

        <div className="sidebar-scroll">
          <button
            className="start-challenge"
            type="button"
            onClick={() => {
              openChallenge()
              if (isMobile) onCloseMobile()
            }}
          >
            <Plus size={14} strokeWidth={2.2} />
            <span className="start-label">Start new challenge</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Start new challenge</span>}
          </button>

          <NavLink
            to="/"
            end
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onCloseMobile}
          >
            <NotebookPen size={16} strokeWidth={1.7} />
            <span className="nav-label">Journal</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Journal</span>}
          </NavLink>

          <NavLink
            to="/accounts"
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onCloseMobile}
          >
            <Layers size={16} strokeWidth={1.7} />
            <span className="nav-label">Portfolio</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Portfolio</span>}
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="account-dock" ref={dockRef}>
            <AnimatePresence>
              {switcherOpen && (
                <motion.div
                  className="account-switcher-pop"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="account-switcher-head">
                    <span>Accounts</span>
                    <span>{accounts.length}</span>
                  </div>
                  {accounts.length === 0 && (
                    <p className="px-2 py-3 text-[10px] leading-relaxed text-[var(--faint)]">
                      No accounts yet. Start a challenge to open your first workspace.
                    </p>
                  )}
                  {accounts.map((account) => {
                    const active = activeAccount?.id === account.id
                    return (
                      <button
                        key={account.id}
                        className={cn('switcher-option', active && 'is-active')}
                        type="button"
                        onClick={() => {
                          setActiveAccount(account.id)
                          setSwitcherOpen(false)
                        }}
                      >
                        <AccountAvatar
                          badge={accountBadge(account)}
                          gradient={accountGradient(account)}
                          size="sm"
                        />
                        <span className="switcher-option-copy">
                          <b>{titleFor(account)}</b>
                          <span>
                            {account.stage} · {account.platform}
                          </span>
                        </span>
                        {active && <Check size={13} className="check" />}
                      </button>
                    )
                  })}
                  <button
                    className="switcher-new"
                    type="button"
                    onClick={() => {
                      setSwitcherOpen(false)
                      openChallenge()
                      if (isMobile) onCloseMobile()
                    }}
                  >
                    <Plus size={13} />
                    Start new challenge
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="account-dock-btn"
              type="button"
              onClick={() => setSwitcherOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={switcherOpen}
            >
              {activeAccount ? (
                <AccountAvatar
                  badge={accountBadge(activeAccount)}
                  gradient={accountGradient(activeAccount)}
                  size="sm"
                />
              ) : (
                <span className="account-avatar account-avatar-sm" style={{ background: 'var(--panel-3)' }}>
                  <span>TA</span>
                </span>
              )}
              <span className="account-dock-copy">
                <b>{activeAccount ? titleFor(activeAccount) : 'No account'}</b>
                <span>{activeAccount ? `${activeAccount.stage} · ${activeAccount.platform}` : 'Start a challenge'}</span>
              </span>
              <ChevronRight size={13} style={{ transform: switcherOpen ? 'rotate(90deg)' : undefined }} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="sidebar-scrim" onClick={onCloseMobile} aria-hidden="true" />
      )}
    </>
  )
}
