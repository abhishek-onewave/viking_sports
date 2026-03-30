'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import HeroCanvas from './HeroCanvas';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.4,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const lineVariants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.6 },
  },
};

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const scrollToPredictor = () => {
    const el = document.getElementById('predictor');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full overflow-hidden bg-viking-deep"
    >
      {/* 3D Canvas */}
      <HeroCanvas />

      {/* Deep left gradient for text readability */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[70%] bg-gradient-to-r from-viking-deep via-viking-deep/85 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[45%] bg-gradient-to-r from-viking-deep/95 to-transparent" />

      {/* Content overlay */}
      <motion.div
        className="relative z-10 flex min-h-screen items-center"
        style={{ y: textY, opacity: textOpacity }}
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-12">
          <motion.div
            className="max-w-xl lg:max-w-[52%]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Eyebrow line */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 mb-2">
              <motion.div
                variants={lineVariants}
                className="origin-left h-px w-8 bg-viking-gold"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-viking-gold/80">
                Sports Memorabilia Intelligence
              </span>
            </motion.div>

            {/* Badge */}
            <motion.div variants={itemVariants} className="mt-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-viking-gold/20 bg-viking-gold/8 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-viking-gold/90">
                <span className="h-1.5 w-1.5 rounded-full bg-viking-gold animate-pulse" />
                XGBoost · 94% Accuracy
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={itemVariants}
              className="mt-7 font-display leading-[1.05] tracking-tight text-viking-snow"
              style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)', fontWeight: 800 }}
            >
              Smarter
              <br />
              <span className="text-gradient-gold">Collectible</span>
              <br />
              Investments
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="mt-6 max-w-[380px] text-[15px] leading-relaxed text-viking-steel"
            >
              Machine learning predictions for sports memorabilia. Our XGBoost model,
              trained on{' '}
              <span className="text-viking-mist font-medium">12,000+ deals</span>,
              surfaces alpha in seconds.
            </motion.p>

            {/* CTA row */}
            <motion.div variants={itemVariants} className="mt-9 flex flex-wrap gap-3">
              <button
                onClick={scrollToPredictor}
                className="group relative overflow-hidden rounded-xl bg-viking-gold px-7 py-3.5 text-sm font-semibold text-viking-deep transition-all duration-300 hover:bg-viking-amber hover:shadow-xl hover:shadow-viking-gold/25 active:scale-[0.97]"
              >
                <span className="relative z-10">Analyze a Deal →</span>
              </button>
              <button
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-xl border border-viking-iron px-7 py-3.5 text-sm font-semibold text-viking-steel transition-all duration-300 hover:border-viking-steel/40 hover:text-viking-snow hover:bg-viking-charcoal/40"
              >
                How it works
              </button>
            </motion.div>

            {/* Stat row */}
            <motion.div variants={itemVariants} className="mt-14 flex gap-8">
              {[
                { value: '94%', label: 'Accuracy' },
                { value: '0.97', label: 'AUC Score' },
                { value: '<2s', label: 'Inference' },
              ].map((stat) => (
                <div key={stat.label} className="group">
                  <div className="text-2xl font-bold text-viking-gold font-display tabular-nums group-hover:text-viking-amber transition-colors">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-viking-steel">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="h-6 w-px bg-gradient-to-b from-viking-steel/0 to-viking-steel/40" />
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="opacity-40">
            <path d="M1 1L7 7L13 1" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-viking-deep via-viking-deep/60 to-transparent" />
    </section>
  );
}
