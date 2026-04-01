'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRecentPredictions, StoredPrediction } from '@/lib/supabase/queries';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardSection() {
  const [predictions, setPredictions] = useState<StoredPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [noSupabase, setNoSupabase] = useState(false);

  const fetchPredictions = async () => {
    try {
      const data = await getRecentPredictions(20);
      setPredictions(data);
    } catch {
      setNoSupabase(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();

    // Listen for new predictions saved from PredictionForm
    const handler = () => fetchPredictions();
    window.addEventListener('prediction-saved', handler);
    return () => window.removeEventListener('prediction-saved', handler);
  }, []);

  const total = predictions.length;
  const buyCount = predictions.filter((p) => p.prediction === 'BUY').length;
  const notBuyCount = total - buyCount;
  const buyPct = total > 0 ? ((buyCount / total) * 100).toFixed(1) : '0';
  const notBuyPct = total > 0 ? ((notBuyCount / total) * 100).toFixed(1) : '0';

  return (
    <section id="dashboard" className="relative py-24 bg-viking-navy">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-gradient-ice md:text-5xl">
            Prediction History
          </h2>
          <p className="mt-4 text-lg text-viking-steel max-w-xl mx-auto">
            Track your analysis history and portfolio insights
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-6 w-6 animate-spin text-viking-steel" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            </div>
          ) : noSupabase || (predictions.length === 0 && !loading) ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-viking-slate/50">
                <svg
                  className="h-7 w-7 text-viking-steel"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                  />
                </svg>
              </div>
              <p className="text-viking-steel text-sm max-w-xs">
                {noSupabase
                  ? 'Connect Supabase to track prediction history'
                  : 'No predictions yet. Use the Deal Analyzer above to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-viking-iron/40">
                    {['Asset Type', 'Hold Period', 'Decade', 'Prediction', 'Probability', 'Confidence', 'Date'].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-viking-steel/70"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p, i) => {
                    const isBuy = p.prediction === 'BUY';
                    return (
                      <tr
                        key={p.id ?? i}
                        className="border-b border-viking-iron/20 transition-colors hover:bg-viking-slate/20"
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-viking-mist whitespace-nowrap">
                          {p.asset_type}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-viking-steel tabular-nums">
                          {p.hold_years} {p.hold_years === 1 ? 'year' : 'years'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-viking-steel">
                          {p.decade}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                              isBuy
                                ? 'bg-viking-buy/15 text-viking-buy'
                                : 'bg-viking-sell/15 text-viking-sell'
                            }`}
                          >
                            {p.prediction}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-viking-steel tabular-nums">
                          {(p.probability * 100).toFixed(1)}%
                        </td>
                        <td className="px-5 py-3.5 text-sm text-viking-steel">
                          {p.confidence}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-viking-steel/60 whitespace-nowrap">
                          {formatRelativeTime(p.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        {predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 grid grid-cols-3 gap-4"
          >
            {[
              { label: 'Total Predictions', value: String(total), accent: 'text-viking-mist' },
              { label: 'BUY Rate', value: `${buyPct}%`, accent: 'text-viking-buy' },
              { label: 'NOT BUY Rate', value: `${notBuyPct}%`, accent: 'text-viking-sell' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass rounded-xl px-5 py-4 text-center"
              >
                <div className={`text-2xl font-bold tabular-nums ${stat.accent}`}>
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-viking-steel">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
