import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { ensureUserProfile } from '@/lib/cloud'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Enter your password to continue.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'That password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for that email.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in your Firebase project.',
  'auth/user-disabled': 'This account has been disabled.',
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  return ERROR_MESSAGES[code] ?? (error as Error | null)?.message ?? 'Something went wrong. Try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured.')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured.')
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    const displayName = name.trim()
    if (displayName) {
      try {
        await updateProfile(credential.user, { displayName })
      } catch {
        // The profile document below still carries the name.
      }
    }
    try {
      await ensureUserProfile(credential.user.uid, {
        name: displayName,
        email: credential.user.email ?? email.trim(),
      })
    } catch {
      // Auth succeeded; a missing profile doc can be repaired on the next login.
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    await firebaseSignOut(auth)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error('Firebase is not configured.')
    await sendPasswordResetEmail(auth, email.trim())
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured: isFirebaseConfigured, signIn, signUp, signOut, resetPassword }),
    [user, loading, signIn, signUp, signOut, resetPassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
