'use client';

import { motion } from 'framer-motion';
import PredictionForm from './PredictionForm';

export default function PredictorSection() {
  return (
    <section id="predictor" className="relative w-full py-24 bg-viking-deep">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-gradient-gold md:text-5xl">
            Deal Analyzer
          </h2>
          <p className="mt-4 text-lg text-viking-steel max-w-xl mx-auto">
            Enter deal parameters to get an AI-powered investment recommendation
          </p>
        </motion.div>

        <PredictionForm />

        {/* Card Investment Model v3 lives on its own route: it scores a specific
            card against real comparable sales, whereas the analyzer above works
            at the deal level. Linked rather than merged so neither is disturbed. */}
        <div className="mt-12 rounded-2xl border border-viking-gold/20 bg-viking-gold/5 px-6 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-sm font-semibold text-viking-snow">
              Analysing a specific card?
            </p>
            <p className="mt-1 text-sm text-viking-steel">
              Card Investment Model v3 matches an exact card to comparable sales and
              returns a maximum recommended purchase price.
            </p>
          </div>
          <a
            href="/analysis"
            className="mt-4 inline-block shrink-0 rounded-xl bg-viking-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-viking-deep transition-colors hover:bg-viking-amber sm:mt-0"
          >
            Open card analysis
          </a>
        </div>
      </div>

      {/* Subtle background texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-viking-charcoal/20 via-transparent to-transparent" />
    </section>
  );
}
