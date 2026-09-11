'use client';

/**
 * CardCombobox.tsx — searchable dropdown for exact card-grade identities.
 *
 * Michael Jordan alone has thousands of predictable identities, so a native
 * <select> is unusable here. This is a combobox in the Viking design system:
 * type to filter, arrow keys to move, Enter to select. Selecting stores the
 * WHOLE identity — the exact grade_uid is what gets submitted, never the
 * display text and never a list index. Typing after a selection clears it.
 */
import { formatDisplayName } from '@/lib/cardAnalyzer/logic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { filterCards } from '@/lib/cardAnalyzer';
import type { CardIdentity } from '@/lib/cardAnalyzer';
import { FieldError } from '@/components/predictor/v3fields';

const MAX_RENDERED_OPTIONS = 150;

const LABEL =
  'block text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel mb-2.5';
const CONTROL =
  'w-full rounded-xl border border-viking-iron/40 bg-viking-slate/30 px-4 py-3 text-sm ' +
  'text-viking-snow placeholder:text-viking-steel/40 outline-none transition-colors ' +
  'focus:border-viking-gold/60 focus:bg-viking-slate/50 ' +
  'focus-visible:ring-1 focus-visible:ring-viking-gold/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function CardCombobox({
  id, label, cards, selected, onSelect, disabled, hint, error,
}: {
  id: string;
  label: string;
  cards: CardIdentity[];
  selected: CardIdentity | null;
  onSelect: (card: CardIdentity | null) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const filtered = useMemo(() => filterCards(cards, query), [cards, query]);
  const rendered = filtered.slice(0, MAX_RENDERED_OPTIONS);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Keep the highlighted option visible while arrowing through the list.
  useEffect(() => {
    if (highlight < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  // The card list changed (player/year switched) — any typed filter is stale.
  useEffect(() => {
    setQuery('');
    setHighlight(-1);
  }, [cards]);

  function choose(card: CardIdentity) {
    onSelect(card);
    setQuery('');
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!open) { setOpen(true); return; }
      const max = rendered.length - 1;
      setHighlight((h) =>
        ev.key === 'ArrowDown' ? Math.min(h + 1, max) : Math.max(h - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (open && highlight >= 0 && rendered[highlight]) choose(rendered[highlight]);
    } else if (ev.key === 'Escape') {
      setOpen(false);
    }
  }

  const shownValue = selected ? formatDisplayName(selected.display_name) : query;

  return (
    <div ref={wrapRef}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={shownValue}
          placeholder={
            disabled
              ? 'Select a player first…'
              : `Search ${cards.length.toLocaleString()} predictable card-grade identities…`
          }
          onChange={(ev) => {
            // Typing invalidates the previous exact selection.
            onSelect(null);
            setQuery(ev.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
          aria-invalid={Boolean(error) || undefined}
          className={CONTROL}
          data-testid="card-combobox"
        />

        {open && !disabled && (
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-xl
                       border border-viking-iron/40 bg-viking-charcoal shadow-2xl shadow-black/50"
          >
            {rendered.length === 0 ? (
              <p className="px-4 py-3.5 text-[13px] text-viking-steel">
                No matching predictable card-grade identities.
              </p>
            ) : (
              <>
                {rendered.map((card, i) => (
                  <div
                    key={card.grade_uid}
                    role="option"
                    aria-selected={selected?.grade_uid === card.grade_uid}
                    data-index={i}
                    onMouseDown={(ev) => { ev.preventDefault(); choose(card); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex cursor-pointer items-baseline justify-between gap-4 border-b
                                border-viking-iron/20 px-4 py-2.5 text-[13px] last:border-b-0
                                ${i === highlight
                                  ? 'bg-viking-slate/60 text-viking-snow'
                                  : 'text-viking-mist hover:bg-viking-slate/40'}`}
                  >
                    <span>{formatDisplayName(card.display_name)}</span>
                    <span className="shrink-0 text-[11px] text-viking-steel/60">
                      {card.historical_sales_count} sales
                    </span>
                  </div>
                ))}
                {filtered.length > MAX_RENDERED_OPTIONS && (
                  <p className="sticky bottom-0 border-t border-viking-iron/30 bg-viking-deep/95
                                px-4 py-2.5 text-[11px] text-viking-steel">
                    Showing {MAX_RENDERED_OPTIONS} of {filtered.length.toLocaleString()}. Keep
                    typing to refine.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-2 text-xs text-viking-steel/60">{hint}</p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
