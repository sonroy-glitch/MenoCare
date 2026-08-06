'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, signup } from '@/lib/auth'
import { useApp } from '@/lib/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useApp()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup fields
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupDOB, setSignupDOB] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')

  useEffect(() => {
    if (window.location.search.includes('mode=signup')) {
      setMode('signup')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const authState = await login(loginEmail, loginPassword)
      setUser(authState.user)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const authState = await signup(
        signupName,
        signupEmail,
        signupDOB,
        signupPassword
      )
      setUser(authState.user)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <img
            src="/menocare-logo.png"
            alt="MenoCare"
            className="mx-auto h-28 w-auto object-contain"
          />
          <p className="mt-2 text-foreground/60">Your Menopause Companion</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-lg p-8">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-8 bg-background p-1 rounded-lg">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-primary text-white'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-accent text-white'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/30 text-primary rounded-lg text-sm">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white"
                disabled={loading}
              >
                {loading ? <><Spinner size="sm" className="mr-2" /> Signing in…</> : 'Sign In'}
              </Button>
              <p className="text-xs text-foreground/50 text-center">
                New here? Switch to Sign Up to create an account.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date of Birth
                </label>
                <Input
                  type="date"
                  value={signupDOB}
                  onChange={(e) => setSignupDOB(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-white"
                disabled={loading}
              >
                {loading ? <><Spinner size="sm" className="mr-2" /> Creating account…</> : 'Create Account'}
              </Button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-foreground/50 mt-6">
          Your health information is secure and private.
        </p>
      </div>
    </div>
  )
}
