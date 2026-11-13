import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/store/AuthProvider'

function AuthSplash() {
  return (
    <div className="auth-page">
      <div className="auth-card auth-splash-card">
        <span className="auth-splash-spinner">
          <Loader2 size={18} className="auth-spin" />
        </span>
        <p className="auth-splash-text">Restoring your workspace…</p>
      </div>
    </div>
  )
}

/** App routes: require a signed-in user whenever Firebase is configured. */
export function RequireAuth() {
  const { user, loading, configured } = useAuth()
  if (!configured) return <Outlet />
  if (loading) return <AuthSplash />
  if (!user) return <Navigate to="/auth/login" replace />
  return <Outlet />
}

/** Auth routes: signed-in users go straight to their workspace. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth()
  if (!configured) return <>{children}</>
  if (loading) return <AuthSplash />
  if (user) return <Navigate to="/metrics" replace />
  return <>{children}</>
}
