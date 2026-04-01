'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/lib/supabase/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="glass-strong rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-viking-buy/15">
          <svg className="h-7 w-7 text-viking-buy" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)]">
          Check Your Email
        </h1>
        <p className="mt-3 text-sm text-viking-steel max-w-xs mx-auto">
          We&apos;ve sent a password reset link to <span className="text-viking-mist font-medium">{email}</span>. Check your inbox and follow the instructions.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl border border-viking-steel/20 px-6 py-3 text-sm font-semibold text-viking-snow transition-all hover:border-viking-steel/40 hover:bg-viking-snow/5"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)] text-center">
        Reset Password
      </h1>
      <p className="mt-2 text-sm text-viking-steel text-center">
        Enter your email and we&apos;ll send you a reset link
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-xl border border-viking-sell/30 bg-viking-sell/10 px-4 py-3 text-sm text-viking-sell">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-viking-iron/50 bg-viking-slate/50 px-4 py-3 text-sm text-viking-snow placeholder:text-viking-steel/50 focus:border-viking-gold/50 focus:outline-none focus:ring-1 focus:ring-viking-gold/30 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-viking-gold py-3.5 text-sm font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-viking-steel">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-viking-gold hover:text-viking-amber transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
