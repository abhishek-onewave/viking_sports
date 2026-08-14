'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const features = [
  {
    title: 'Historical Data',
    description:
      'Built on 44,596 verified auction results from six houses, 2004-2026 — every figure traces to a real lot',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  },
  {
    title: 'ML Analysis',
    description:
      'Validated on 2,574 repeat sales of the same items. Flagged deals beat the market 69% of the time against a 50% baseline — a 19-point edge, measured to within 2 points',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
        />
      </svg>
    ),
  },
  {
    title: 'Instant Prediction',
    description:
      'Get buy/hold recommendations in milliseconds with confidence scoring',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
        />
      </svg>
    ),
  },
];

const stats: {
  label: string; target: number; suffix: string; decimals?: number;
}[] = [
  { label: 'Verified Sales', target: 44596, suffix: '' },
  { label: 'Repeat-Sale Pairs', target: 2574, suffix: '' },
  { label: 'Years of Data', target: 22, suffix: '' },
  { label: 'Edge vs Baseline', target: 19, suffix: ' pts' },
];

function AnimatedCounter({
  target,
  suffix = '',
  decimals = 0,
  inView,
}: {
  target: number;
  suffix?: string;
  decimals?: number;
  inView: boolean;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;

    const start = performance.now();
    const duration = 1800;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, target]);

  return (
    <span className="tabular-nums">
      {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
      {suffix}
    </span>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function AboutSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });
  const statsInView = useInView(statsRef, { once: true, margin: '-40px' });

  return (
    <section id="about" ref={sectionRef} className="relative py-24 bg-viking-deep">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-viking-snow md:text-5xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-viking-steel max-w-xl mx-auto">
            Three steps from deal data to actionable intelligence
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              className="glass rounded-2xl p-8 group"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-viking-gold/10 text-viking-gold transition-colors duration-300 group-hover:bg-viking-gold/20">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-viking-snow mb-3">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-viking-steel">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stat counters */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-xl px-6 py-6 text-center"
            >
              <div className="text-3xl font-bold text-viking-gold">
                <AnimatedCounter
                  target={stat.target}
                  suffix={stat.suffix}
                  decimals={stat.decimals ?? 0}
                  inView={statsInView}
                />
              </div>
              <div className="mt-2 text-xs font-medium uppercase tracking-wider text-viking-steel">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-viking-charcoal/30 via-transparent to-transparent" />
    </section>
  );
}
