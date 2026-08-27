'use client';
/**
 * v3fields.tsx — form controls in the Viking Sports design system.
 *
 * Built from the app's existing tokens (viking-slate/iron/gold/steel) and its
 * `rounded-xl` card treatment, so the v3 analyser matches the Deal Analyzer it
 * sits beside. Accessibility is structural: real <label htmlFor>, errors wired
 * through aria-describedby and announced via role="alert", radio groups as
 * <fieldset>/<legend> so a screen reader hears the question first.
 */
import type { ReactNode } from 'react';

const LABEL =
  'block text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel mb-2.5';
const CONTROL =
  'w-full rounded-xl border border-viking-iron/40 bg-viking-slate/30 px-4 py-3 text-sm ' +
  'text-viking-snow placeholder:text-viking-steel/40 outline-none transition-colors ' +
  'focus:border-viking-gold/60 focus:bg-viking-slate/50 ' +
  'focus-visible:ring-1 focus-visible:ring-viking-gold/40';
const CONTROL_ERROR = 'border-viking-sell/60 bg-viking-sell/5';

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-xs leading-snug text-viking-sell">
      {children}
    </p>
  );
}

export function TextField({
  id, label, value, onChange, placeholder, error, hint,
  type = 'text', inputMode, min, max, prefix, autoComplete = 'off',
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; hint?: string;
  type?: 'text' | 'number'; inputMode?: 'text' | 'numeric' | 'decimal';
  min?: number; max?: number; prefix?: string; autoComplete?: string;
}) {
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        {prefix && (
          <span aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-viking-steel/60">
            {prefix}
          </span>
        )}
        <input
          id={id} name={id} type={type} inputMode={inputMode} min={min} max={max}
          value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={[error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
          className={`${CONTROL} ${prefix ? 'pl-9' : ''} ${error ? CONTROL_ERROR : ''}`}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-2 text-xs text-viking-steel/60">{hint}</p>
      )}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

export function SelectField({
  id, label, value, onChange, options, error,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[]; error?: string;
}) {
  const errId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <select
          id={id} name={id} value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errId : undefined}
          className={`${CONTROL} appearance-none pr-10 ${error ? CONTROL_ERROR : ''}`}
        >
          {options.map((o) => (
            // Dark option background: the OS default is white and would flash a
            // bright panel out of an otherwise dark page.
            <option key={o.value} value={o.value} className="bg-viking-charcoal">
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 20 20"
          className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-viking-steel/60">
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

export function RadioGroup({
  name, legend, value, onChange, options, error,
}: {
  name: string; legend: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[]; error?: string;
}) {
  const errId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className={LABEL}>{legend}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const on = value === o.value;
          return (
            <label key={o.value} htmlFor={id}
              className={`cursor-pointer rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-all
                focus-within:ring-1 focus-within:ring-viking-gold/50
                ${on
                  ? 'border-viking-gold/70 bg-viking-gold/10 text-viking-snow'
                  : 'border-viking-iron/40 bg-viking-slate/20 text-viking-steel hover:border-viking-steel/50 hover:text-viking-mist'}`}>
              {/* sr-only, not hidden: a visually-hidden native radio keeps
                  arrow-key group navigation that a div+role would lose. */}
              <input id={id} type="radio" name={name} value={o.value}
                checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
      <FieldError id={errId}>{error}</FieldError>
    </fieldset>
  );
}

export function SubmitButton({ loading, children }: { loading?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={loading} aria-busy={loading || undefined}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-viking-gold px-6 py-3.5
                 text-sm font-semibold text-viking-deep transition-colors hover:bg-viking-amber
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/60
                 focus-visible:ring-offset-2 focus-visible:ring-offset-viking-deep
                 disabled:cursor-not-allowed disabled:opacity-50">
      {loading && (
        <span aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-viking-deep/25 border-t-viking-deep" />
      )}
      {children}
    </button>
  );
}
