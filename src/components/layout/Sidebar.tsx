import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Layers, BarChart3, NotebookPen, LogOut, Plus, ChevronsUpDown, Settings } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '@/store/AppStore'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTheme } from '@/hooks/useTheme'
import { useProfile } from '@/hooks/useProfile'
import { initialsFor } from '@/lib/profile'

import logoLight from '../../../assets/logolight.png'
import logoDark from '../../../assets/logodark.png'

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapsed?: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { openChallenge, openSettings } = useApp()
  const { isDark } = useTheme()
  const profile = useProfile()
  const initials = initialsFor(profile.name)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 900px)')

  useEffect(() => {
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!profileOpen) return
    const onClick = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [profileOpen])

  return (
    <>
      <aside className={cn('sidebar', mobileOpen && 'mobile-open')} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <img className="sidebar-logo" src={isDark ? logoDark : logoLight} alt="Trader Area" />
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
            to="/metrics"
            end
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onCloseMobile}
          >
            <BarChart3 size={16} strokeWidth={1.7} />
            <span className="nav-label">Metrics</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Metrics</span>}
          </NavLink>

          <NavLink
            to="/journal"
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onCloseMobile}
          >
            <NotebookPen size={16} strokeWidth={1.7} />
            <span className="nav-label">Journal</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Journal</span>}
          </NavLink>

          <NavLink
            to="/portfolio"
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onCloseMobile}
          >
            <Layers size={16} strokeWidth={1.7} />
            <span className="nav-label">Portfolio</span>
            {collapsed && !isMobile && <span className="nav-tooltip">Portfolio</span>}
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-profile" ref={profileRef}>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className="profile-pop"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button
                    className="profile-menu-item"
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      openSettings()
                    }}
                  >
                    <span className="profile-menu-icon">
                      <Settings size={15} />
                    </span>
                    <span className="profile-menu-copy">
                      <b>Settings</b>
                    </span>
                  </button>

                  <div className="profile-menu-sep" role="separator" />

                  <button
                    className="profile-menu-item"
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/auth/login')
                    }}
                  >
                    <span className="profile-menu-icon">
                      <LogOut size={15} />
                    </span>
                    <span className="profile-menu-copy">
                      <b>Log out</b>
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className={cn('sidebar-profile-btn', profileOpen && 'is-open')}
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={collapsed ? `${profile.name} · ${profile.email}` : undefined}
            >
              <span className="sidebar-profile-avatar">{initials}</span>
              <span className="sidebar-profile-copy">
                <b>Admin</b>
                <span>admin@tradersarea.ai</span>
              </span>
              <ChevronsUpDown size={13} className="sidebar-profile-chevron" />
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
