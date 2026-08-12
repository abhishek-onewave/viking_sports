'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import DealAnalyzer from './DealAnalyzer';
import ValuationForm from './ValuationForm';

/**
 * Two analyzers, because they answer different questions and measurably differ
 * in what they can do:
 *
 *   Deal Analyzer  asset type + hold + price + year   ROC-AUC 0.782
 *                  -> base rate for a TYPE of deal. Cannot separate two items
 *                     in the same category (one input combination held 94 real
 *                     deals ranging 0.36x to 5.12x).
 *
 *   Item Lookup    player + year + set + card# + grade
 *                  -> actual comparable sales for ONE specific card, plus a
 *                     fair-value estimate (R2 0.92 on graded cards).
 *
 * Neither subsumes the other: the first shapes a portfolio, the second prices
 * a lot.
 */
const TABS = [
  {
    id: 'deal',
    label: 'Deal Analyzer',
    blurb: 'Buy / pass signal for a type of deal',
  },
  {
    id: 'item',
    label: 'Item Lookup',
    blurb: 'Comparable sales and fair value for a specific card',
  },
] as const;

export default function PredictorSection() {
  const [tab, setTab] = useState<'deal' | 'item'>('deal');

  return (
    <section id="predictor" className="relative w-full py-24 bg-viking-deep">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-gradient-gold md:text-5xl">
            Deal Analyzer
          </h2>
          <p className="mt-4 text-lg text-viking-steel max-w-2xl mx-auto">
            Two views: the shape of a deal, or the record of a specific card.
          </p>
        </motion.div>

        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-xl border px-5 py-3 text-left transition-colors ${
                tab === t.id
                  ? 'border-viking-gold/60 bg-viking-gold/10'
                  : 'border-viking-charcoal/60 hover:border-viking-charcoal'
              }`}
            >
              <span
                className={`block text-sm font-semibold ${
                  tab === t.id ? 'text-viking-gold' : 'text-viking-parchment'
                }`}
              >
                {t.label}
              </span>
              <span className="mt-0.5 block text-xs text-viking-steel">{t.blurb}</span>
            </button>
          ))}
        </div>

        {tab === 'deal' ? <DealAnalyzer /> : <ValuationForm />}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-viking-charcoal/20 via-transparent to-transparent" />
    </section>
  );
}
