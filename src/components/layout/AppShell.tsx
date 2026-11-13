import { useEffect, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { readStorage, writeStorage } from '@/lib/storage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useApp } from '@/store/AppStore'
import { SyncError } from './SyncScreen'

export function AppShell() {
  const { syncStatus } = useApp()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = readStorage('ta-ui-sidebar-collapsed', '')
    if (stored) return stored === '1'
    return readStorage('ta-sidebar-collapsed', '0') === '1'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()
  const isMobile = useMediaQuery('(max-width: 900px)')

  useEffect(() => {
    writeStorage('ta-ui-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  if (syncStatus === 'error') return <SyncError />

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main className="main-column">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <div className="content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
