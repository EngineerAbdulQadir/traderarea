import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      navigate('/')
    }, 600)
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />
      <Card className="auth-card">
        <div className="auth-head">
          <span className="auth-kicker">Trader Area</span>
          <h1 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-sub">
            {isSignup
              ? 'Start tracking your challenges, rules and equity in one place.'
              : 'Sign in to continue to your trading workspace.'}
          </p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={cn('auth-toggle-btn', !isSignup && 'is-active')}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={cn('auth-toggle-btn', isSignup && 'is-active')}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              <span className="auth-label">Name</span>
              <div className="auth-input-wrap">
                <User size={14} />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span className="auth-label">Email</span>
            <div className="auth-input-wrap">
              <Mail size={14} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <div className="auth-input-wrap">
              <Lock size={14} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
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
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {!isSignup && (
            <div className="auth-row">
              <label className="auth-check">
                <input type="checkbox" /> Remember me
              </label>
              <button type="button" className="auth-link">Forgot password?</button>
            </div>
          )}

          <Button variant="primary" size="lg" className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            {!loading && <ArrowRight size={14} />}
          </Button>
        </form>

        <p className="auth-foot">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => setMode(isSignup ? 'login' : 'signup')}
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </Card>
    </div>
  )
}