import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'

import logoForm from '../../assets/logoform.png'
import { authErrorMessage, useAuth } from '@/store/AuthProvider'

type Mode = 'login' | 'signup' | 'forgot'

const AUTH_PATH: Record<Mode, string> = {
  login: '/auth/login',
  signup: '/auth/signup',
  forgot: '/auth/forgot-password',
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword, configured } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  useEffect(() => {
    setSent(false)
    setLoading(false)
    setError('')
  }, [mode])

  const switchMode = (next: Mode) => {
    navigate(AUTH_PATH[next])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!configured) {
      setError('Firebase is not configured yet. Add your project keys to .env.local and restart the dev server.')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (isForgot) {
        await resetPassword(email)
        setSent(true)
      } else if (isSignup) {
        await signUp(name, email, password)
        navigate('/metrics', { replace: true })
      } else {
        await signIn(email, password)
        navigate('/metrics', { replace: true })
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-orb auth-orb-1" />
        <span className="auth-orb auth-orb-2" />
        <span className="auth-orb auth-orb-3" />
        <span className="auth-orb auth-orb-4" />
        <span className="auth-grid" />
        <span className="auth-noise" />
      </div>

      <div className="auth-card">
        <img className="auth-logo" src={logoForm} alt="Trader Area" />

        {sent && isForgot ? (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-sub">
              We sent a password reset link to <strong>{email}</strong>. It may take a minute to
              arrive.
            </p>
            <button
              type="button"
              className="auth-submit auth-submit-sent"
              onClick={() => switchMode('login')}
            >
              Back to sign in
              <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <>
            <h1 className="auth-title">
              {isForgot ? 'Forgot password' : isSignup ? 'Create account' : 'Sign in'}
            </h1>
            <p className="auth-sub">
              {isForgot
                ? "Enter your email and we'll send you a secure reset link."
                : isSignup
                  ? 'Start tracking your challenges, journal and performance.'
                  : 'Continue to your trading workspace.'}
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {!configured && (
                <p className="auth-notice">
                  Firebase is not configured. Copy <code>.env.local.example</code> to{' '}
                  <code>.env.local</code> and add your project keys.
                </p>
              )}

              {isSignup && (
                <label className="auth-field">
                  <span className="auth-label">Full name</span>
                  <span className="auth-line-input">
                    <input
                      type="text"
                      name="name"
                      placeholder="Alex Morgan"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </span>
                </label>
              )}

              <label className="auth-field">
                <span className="auth-label">Email address</span>
                <span className="auth-line-input">
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </span>
              </label>

              {!isForgot && (
                <label className="auth-field">
                  <span className="auth-label">Password</span>
                  <span className="auth-line-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </span>
                </label>
              )}

              {isSignup && (
                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" name="terms" required /> I agree to the Terms
                  </label>
                </div>
              )}

              {!isSignup && !isForgot && (
                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" name="remember" /> Remember me
                  </label>
                  <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <p className="auth-error" role="alert">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
                {loading ? <Loader2 className="auth-spin" size={15} /> : <ArrowRight size={15} />}
              </button>
            </form>

            <p className="auth-switch">
              {isSignup
                ? 'Already have an account?'
                : isForgot
                  ? 'Remember your password?'
                  : 'No account yet?'}{' '}
              <button
                type="button"
                className="auth-link"
                onClick={() => switchMode(isSignup || isForgot ? 'login' : 'signup')}
              >
                {isSignup || isForgot ? 'Sign in' : 'Create one'}
              </button>
            </p>

            <p className="auth-legal">
              By continuing you agree to our <span>Terms of Service</span> and{' '}
              <span>Privacy Policy</span>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
