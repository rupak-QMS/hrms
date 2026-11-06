'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error,   setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      // Always show sent — even if email not found (prevents enumeration)
      setStatus('sent')
    } catch {
      setStatus('error')
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 dark:bg-gray-800">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl"></span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Enter your email and we'll send a reset link.</p>
        </div>

        {status === 'sent' ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm dark:bg-[#0F1E2E] dark:border-[#1A6080]/40">
            <div className="text-4xl mb-3"></div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">Check your email</h2>
            <p className="text-sm text-gray-500 leading-relaxed dark:text-gray-400">
              If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
              The link expires in 1 hour.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4 dark:bg-[#0F1E2E] dark:border-[#1A6080]/40">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email address</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@organisation.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3D52] dark:border-[#1A6080]/40"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={status === 'loading' || !email}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              <Link href="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
