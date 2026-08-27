import type { Metadata } from 'next';
import IndexesView from '@/components/indexes/IndexesView';
import { indexData } from '@/lib/indexes';

export const metadata: Metadata = {
  title: 'Sport Indexes | Viking Sports',
  description:
    'Card Ladder index performance by sport, with the top cards driving each index.',
};

export default function IndexesPage() {
  return (
    <main className="min-h-screen bg-viking-deep">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 lg:px-8 lg:pt-32">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
            Market data
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-gradient-gold md:text-5xl">
            Sport Indexes
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-viking-steel">
            Index performance across {indexData.sportCount} sports, and the{' '}
            {indexData.cardCount}{' '}cards driving them. Figures are Card
            Ladder&rsquo;s own, shown as published.
          </p>
        </header>

        <IndexesView />
      </div>
    </main>
  );
}
