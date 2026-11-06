'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const params   = useSearchParams()
  const router   = useRouter()
  const token    = params.get('token') ?? ''

  const [valid,    setValid]    = useState<boolean | null>(null) // null = checking
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!token) { setValid(false); return }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => setValid(d.valid))
      .catch(() => setValid(false))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setStatus('loading'); setError('')
    const res  = await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (!res.ok) { setStatus('error'); setError(data.error ?? 'Failed. Please try again.'); return }
    setStatus('done')
    setTimeout(() => router.push('/login'), 2500)
  }

  if (valid === null) {
    return <div className="text-center text-sm text-gray-400 py-8">Checking link…</div>
  }

  if (!valid) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm dark:bg-[#0F1E2E] dark:border-[#1A6080]/40">
        <div className="text-4xl mb-3">⏰</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">Link expired or invalid</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">This reset link has expired or already been used.</p>
        <Link href="/forgot-password" className="mt-5 inline-block text-sm text-brand-600 hover:underline font-medium">
          Request a new reset link →
        </Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm dark:bg-[#0F1E2E] dark:border-[#1A6080]/40">
        <div className="text-4xl mb-3"></div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">Password updated!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4 dark:bg-[#0F1E2E] dark:border-[#1A6080]/40">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">New password</label>
        <input
          type="password"
          required
          autoFocus
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3D52] dark:border-[#1A6080]/40"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Confirm new password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3D52] dark:border-[#1A6080]/40"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === 'loading' || !password || !confirm}
        className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
      >
        {status === 'loading' ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 dark:bg-[#0A1929]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl"></span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Choose a strong password for your account.</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Loading…</div>}>
          <ResetForm />
        </Suspense>
        <p className="text-center text-sm text-gray-500 mt-4 dark:text-gray-400">
          <Link href="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
