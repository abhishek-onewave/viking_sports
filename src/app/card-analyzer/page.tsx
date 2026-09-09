import type { Metadata } from 'next';
import CardAnalyzerV4 from '@/components/analyzer/CardAnalyzerV4';

export const metadata: Metadata = {
  title: 'Card Analyzer | Valhalla Sports',
  description:
    'Select an exact card-grade identity and forecast next week’s market ' +
    'valuation with the Valhalla Card Investment Model V4, including BUY, ' +
    'DO NOT BUY or REVIEW guidance at your entered price.',
};

export default function CardAnalyzerPage() {
  return (
    <main className="min-h-screen bg-viking-deep">
      <CardAnalyzerV4 />
    </main>
  );
}
