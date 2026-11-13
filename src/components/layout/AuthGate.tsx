import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'

/** App routes: require a signed-in user whenever Firebase is configured. */
export function RequireAuth() {
  const { user, loading, configured } = useAuth()
  if (!configured) return <Outlet />
  if (loading) return null
  if (!user) return <Navigate to="/auth/login" replace />
  return <Outlet />
}

/** Auth routes: signed-in users go straight to their workspace. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth()
  if (!configured) return <>{children}</>
  if (loading) return null
  if (user) return <Navigate to="/metrics" replace />
  return <>{children}</>
}
