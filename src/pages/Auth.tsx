import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LineChart,
  Lock,
  Mail,
  NotebookPen,
  ShieldCheck,
  Target,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

import logoLight from '../../assets/logolight.png'
import logoDark from '../../assets/logodark.png'

type Mode = 'login' | 'signup'

const FEATURES = [
  {
    icon: Target,
    title: 'Challenge tracking',
    copy: 'Profit targets, daily loss and drawdown captured in one calm view.',
  },
  {
    icon: NotebookPen,
    title: 'Structured journal',
    copy: 'Log every setup, screenshot and lesson while the trade is fresh.',
  },
  {
    icon: LineChart,
    title: 'Performance analytics',
    copy: 'Win rate, expectancy and equity curves that actually mean something.',
  },
]

export function AuthPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
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
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-grid" aria-hidden="true" />
        <div className="auth-brand-glow" aria-hidden="true" />

        <div className="auth-brand-top">
          <img className="auth-brand-logo" src={logoDark} alt="Trader Area" />
          <span className="auth-brand-badge">
            <ShieldCheck size={13} strokeWidth={2} />
            Funded trader workspace
          </span>
        </div>

        <div className="auth-brand-body">
          <h2>
            Trade with clarity.
            <br />
            <span>Track every edge.</span>
          </h2>
          <p>
            One focused workspace for your challenges, journal and performance — built for traders
            who treat the process as seriously as the outcome.
          </p>

          <ul className="auth-features">
            {FEATURES.map(({ icon: Icon, title, copy }) => (
              <li className="auth-feature" key={title}>
                <span className="auth-feature-icon">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span>
                  <b>{title}</b>
                  <span>{copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-brand-foot">
          <div className="auth-stats">
            <div className="auth-stat">
              <b>12k+</b>
              <span>Traders</span>
            </div>
            <div className="auth-stat">
              <b>480k</b>
              <span>Trades logged</span>
            </div>
            <div className="auth-stat">
              <b>99.9%</b>
              <span>Uptime</span>
            </div>
          </div>
          <span className="auth-brand-note">Built for disciplined traders.</span>
        </div>

        <svg className="auth-curve" viewBox="0 0 320 120" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="authCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7fb0ff" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#7fb0ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 96 L40 84 L70 90 L104 62 L138 70 L172 44 L206 52 L240 30 L274 36 L320 12 L320 120 L0 120 Z"
            fill="url(#authCurveFill)"
          />
          <path
            d="M0 96 L40 84 L70 90 L104 62 L138 70 L172 44 L206 52 L240 30 L274 36 L320 12"
            stroke="#8fb8ff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-top">
          <span className="auth-mobile-logo">
            <img src={isDark ? logoDark : logoLight} alt="Trader Area" />
          </span>
          <ThemeToggle />
        </div>

        <div className="auth-form-wrap">
          <div className="auth-head">
            <span className="auth-kicker">{isSignup ? 'Get started' : 'Account access'}</span>
            <h1 className="auth-title">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
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
                <span className="auth-label">Full name</span>
                <div className="auth-input-wrap">
                  <User size={15} />
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
              <span className="auth-label">Email address</span>
              <div className="auth-input-wrap">
                <Mail size={15} />
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
                <Lock size={15} />
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
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {!isSignup && (
              <div className="auth-row">
                <label className="auth-check">
                  <input type="checkbox" /> Remember me
                </label>
                <button type="button" className="auth-link">
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              {!loading && <ArrowRight size={15} />}
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

          <p className="auth-legal">
            By continuing you agree to our <span>Terms of Service</span> and{' '}
            <span>Privacy Policy</span>.
          </p>
        </div>
      </main>
    </div>
  )
}
