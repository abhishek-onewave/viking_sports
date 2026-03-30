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
      </div>

      {/* Subtle background texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-viking-charcoal/20 via-transparent to-transparent" />
    </section>
  );
}
