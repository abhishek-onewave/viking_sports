/** Proxy: supported players for the Card Analyzer (Model V4). */
import { proxyAnalyzerGet } from '@/lib/cardAnalyzer/serviceProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyAnalyzerGet('/players');
}
