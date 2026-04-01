'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/lib/supabase/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-strong rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-viking-buy/15">
          <svg className="h-7 w-7 text-viking-buy" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)]">
          Password Updated
        </h1>
        <p className="mt-3 text-sm text-viking-steel">
          Redirecting you to sign in...
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-viking-iron/50 bg-viking-slate/50 px-4 py-3 text-sm text-viking-snow placeholder:text-viking-steel/50 focus:border-viking-gold/50 focus:outline-none focus:ring-1 focus:ring-viking-gold/30 transition-colors';

  return (
    <div className="glass-strong rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)] text-center">
        Set New Password
      </h1>
      <p className="mt-2 text-sm text-viking-steel text-center">
        Choose a strong password for your account
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-xl border border-viking-sell/30 bg-viking-sell/10 px-4 py-3 text-sm text-viking-sell">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Min. 6 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`${inputClass} ${
              confirmPassword && password !== confirmPassword
                ? 'border-viking-sell/50'
                : ''
            }`}
            placeholder="Re-enter your password"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1.5 text-xs text-viking-sell">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-viking-gold py-3.5 text-sm font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
