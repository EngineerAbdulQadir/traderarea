import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'
import {
  hasDevOwnerSession,
  isAuthorizedOwner,
  isWaitlistOnly,
} from '@/lib/access'

/**
 * Evaluates whether the current session can enter the workspace.
 * - Waitlist-only mode: public visitors cannot access any route besides `/waitlist`.
 *   Signed-in owners (Firebase Auth, or local dev session in DEV) retain full access.
 * - Normal mode: requires Firebase sign-in when Firebase is configured.
 */
export function useWorkspaceAccess() {
  const { user, loading, configured } = useAuth()

  if (configured && loading) {
    return { loading: true, allowed: false, user, configured }
  }

  if (isWaitlistOnly) {
    const allowed = configured ? isAuthorizedOwner(user) : hasDevOwnerSession()
    return { loading: false, allowed, user, configured }
  }

  const allowed = configured ? Boolean(user) : true
  return { loading: false, allowed, user, configured }
}

/** App routes: require an authorized session when gated. */
export function RequireAuth() {
  const { loading, allowed } = useWorkspaceAccess()
  if (loading) return null
  if (!allowed) {
    return <Navigate to={isWaitlistOnly ? '/waitlist' : '/auth/login'} replace />
  }
  return <Outlet />
}

/**
 * Auth routes:
 * - Standard `/auth/*` routes are blocked in waitlist-only mode and redirect to `/waitlist`.
 * - The private secret owner route passes `allowSecretRoute` so it remains reachable.
 */
export function GuestOnly({
  children,
  allowSecretRoute = false,
}: {
  children: React.ReactNode
  allowSecretRoute?: boolean
}) {
  const { loading, allowed } = useWorkspaceAccess()
  if (loading) return null
  if (allowed) return <Navigate to="/metrics" replace />
  if (isWaitlistOnly && !allowSecretRoute) {
    return <Navigate to="/waitlist" replace />
  }
  return <>{children}</>
}

/** Signup route: disabled during waitlist-only mode. */
export function SignupGate({ children }: { children: React.ReactNode }) {
  if (isWaitlistOnly) return <Navigate to="/waitlist" replace />
  return <GuestOnly>{children}</GuestOnly>
}

/** Root index route: sends public visitors to `/waitlist`, or `/metrics` when owner is signed in. */
export function RootRedirect() {
  const { loading, allowed } = useWorkspaceAccess()
  if (loading) return null
  if (isWaitlistOnly && !allowed) {
    return <Navigate to="/waitlist" replace />
  }
  return <Navigate to="/metrics" replace />
}
