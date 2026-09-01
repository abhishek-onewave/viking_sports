import type { Metadata } from 'next';
import CardInvestmentV3 from '@/components/predictor/CardInvestmentV3';

export const metadata: Metadata = {
  title: 'Card Investment Analysis | Valhalla Sports',
  description:
    'Match a card to comparable sales, estimate current and future value, and see the maximum you can pay while clearing the required return.',
};

export default function AnalysisPage() {
  return (
    <main className="min-h-screen bg-viking-deep">
      <CardInvestmentV3 />
    </main>
  );
}
