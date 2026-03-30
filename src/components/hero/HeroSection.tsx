'use client';

import { motion } from 'framer-motion';
import HeroCanvas from './HeroCanvas';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export default function HeroSection() {
  const scrollToPredictor = () => {
    const el = document.getElementById('predictor');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-viking-deep">
      {/* 3D Canvas - full section background */}
      <HeroCanvas />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <motion.div
            className="max-w-2xl lg:max-w-[60%]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 rounded-full border border-viking-gold/20 bg-viking-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-viking-gold backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-viking-gold animate-pulse" />
                AI-Powered Analysis
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={itemVariants}
              className="mt-8 font-display text-5xl font-bold leading-tight tracking-tight text-viking-snow md:text-7xl"
            >
              Smarter Collectible
              <br />
              <span className="text-gradient-gold">Investments</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="mt-6 max-w-lg text-lg leading-relaxed text-viking-steel"
            >
              Machine learning predictions for sports memorabilia. Analyze deals
              in seconds with our XGBoost model trained on historical portfolio
              data.
            </motion.p>

            {/* CTA */}
            <motion.div variants={itemVariants} className="mt-10 flex gap-4">
              <button
                onClick={scrollToPredictor}
                className="rounded-lg bg-viking-gold px-8 py-4 font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98]"
              >
                Analyze a Deal
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('features');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-lg border border-viking-steel/20 px-8 py-4 font-semibold text-viking-snow transition-all duration-300 hover:border-viking-steel/40 hover:bg-viking-snow/5"
              >
                Learn More
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              variants={itemVariants}
              className="mt-16 flex gap-10"
            >
              {[
                { value: '94%', label: 'Model Accuracy' },
                { value: '12K+', label: 'Cards Analyzed' },
                { value: '<2s', label: 'Prediction Time' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-viking-gold">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-viking-steel">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient overlay for smooth section transition */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-viking-deep to-transparent" />

      {/* Side gradient to improve text readability over 3D canvas */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[65%] bg-gradient-to-r from-viking-deep via-viking-deep/80 to-transparent" />
    </section>
  );
}
