'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/supabase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)] text-center">
        Welcome Back
      </h1>
      <p className="mt-2 text-sm text-viking-steel text-center">
        Sign in to your account
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-xl border border-viking-sell/30 bg-viking-sell/10 px-4 py-3 text-sm text-viking-sell">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Email
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-viking-gold hover:text-viking-amber transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-viking-iron/50 bg-viking-slate/50 px-4 py-3 text-sm text-viking-snow placeholder:text-viking-steel/50 focus:border-viking-gold/50 focus:outline-none focus:ring-1 focus:ring-viking-gold/30 transition-colors"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-viking-gold py-3.5 text-sm font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-viking-steel">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-viking-gold hover:text-viking-amber transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}
