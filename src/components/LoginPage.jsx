import { useState } from 'react'
import { supabase } from '../supabase'

const MODES = {
  signin: { title: 'Welcome back', cta: 'Sign in', alt: 'New here?', altCta: 'Create an account' },
  signup: { title: 'Create your account', cta: 'Sign up', alt: 'Already have an account?', altCta: 'Sign in' },
  forgot: { title: 'Reset your password', cta: 'Send reset link', alt: 'Remembered it?', altCta: 'Back to sign in' },
}

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const m = MODES[mode]

  const switchTo = (next) => {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user && !data.session) {
          // Email confirmation required
          setInfo("Account created — check your email to confirm and then sign in.")
        }
        // If a session is returned (email confirmation off), App.jsx will pick it up via onAuthStateChange
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setInfo("If an account exists for that email, we've sent a reset link.")
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Soft brand-tinted backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(30,95,165,0.10), transparent 50%), radial-gradient(circle at 80% 80%, rgba(94,179,60,0.10), transparent 50%)',
        }}
      />

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" className="h-14 w-14 mx-auto object-contain" />
          <div className="mt-4 font-display font-bold text-2xl tracking-tightest">
            AllyTechSoft <span className="text-brand-gradient">Invoice</span>
          </div>
          <div className="mt-1 text-xs font-mono uppercase tracking-[0.25em] text-mute">
            Invoicing for the multi-device era
          </div>
        </div>

        {/* Card */}
        <div className="card p-7 md:p-8">
          <h1 className="font-display font-semibold text-2xl tracking-tightest mb-1">{m.title}</h1>
          <p className="text-sm text-ash mb-6">
            {mode === 'forgot'
              ? "Enter the email associated with your account and we'll send a reset link."
              : 'Use your email and password to continue.'}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label-base">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
                placeholder="you@example.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label-base">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchTo('forgot')}
                      className="text-xs text-brandBlue hover:underline mb-1.5"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2.5 leading-snug">
                {error}
              </div>
            )}
            {info && (
              <div className="text-sm text-brandGreenDark bg-success/10 rounded-lg px-3 py-2.5 leading-snug">
                {info}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-gradient w-full py-3">
              {loading ? 'Please wait…' : m.cta}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t hairline text-center text-sm text-ash">
            {m.alt}{' '}
            <button
              type="button"
              onClick={() =>
                switchTo(mode === 'signin' ? 'signup' : 'signin')
              }
              className="text-brandBlue hover:underline font-medium"
            >
              {m.altCta}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-mute mt-6">
          Your invoices and customers sync across every device you sign in on.
        </p>
      </div>
    </div>
  )
}
