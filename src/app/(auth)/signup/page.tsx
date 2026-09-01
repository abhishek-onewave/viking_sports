'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/supabase/auth';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!form.termsAccepted) {
      setError('You must accept the Terms & Conditions');
      return;
    }

    setLoading(true);

    try {
      await signUp({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-viking-iron/50 bg-viking-slate/50 px-4 py-3 text-sm text-viking-snow placeholder:text-viking-steel/50 focus:border-viking-gold/50 focus:outline-none focus:ring-1 focus:ring-viking-gold/30 transition-colors';

  return (
    <div className="glass-strong rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-viking-snow font-[family-name:var(--font-display)] text-center">
        Create Account
      </h1>
      <p className="mt-2 text-sm text-viking-steel text-center">
        Join Valhalla Sports to start analyzing deals
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-viking-sell/30 bg-viking-sell/10 px-4 py-3 text-sm text-viking-sell">
            {error}
          </div>
        )}

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className={inputClass}
              placeholder="John"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className={inputClass}
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            required
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className={inputClass}
            placeholder="Min. 6 characters"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-viking-steel mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            className={`${inputClass} ${
              form.confirmPassword && form.password !== form.confirmPassword
                ? 'border-viking-sell/50 focus:border-viking-sell/50 focus:ring-viking-sell/30'
                : ''
            }`}
            placeholder="Re-enter your password"
          />
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="mt-1.5 text-xs text-viking-sell">Passwords do not match</p>
          )}
          {form.confirmPassword && form.password === form.confirmPassword && form.confirmPassword.length > 0 && (
            <p className="mt-1.5 text-xs text-viking-buy">Passwords match</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => update('termsAccepted', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-viking-iron/50 bg-viking-slate/50 text-viking-gold focus:ring-viking-gold/30 cursor-pointer accent-viking-gold"
          />
          <label htmlFor="terms" className="text-xs text-viking-steel leading-relaxed cursor-pointer">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="text-viking-gold hover:text-viking-amber underline underline-offset-2">
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link href="/terms" target="_blank" className="text-viking-gold hover:text-viking-amber underline underline-offset-2">
              Privacy Policy
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !form.termsAccepted}
          className="w-full rounded-xl bg-viking-gold py-3.5 text-sm font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-viking-steel">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-viking-gold hover:text-viking-amber transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
