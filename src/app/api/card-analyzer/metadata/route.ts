/** Proxy: model version, freshness, assumptions and holdout performance. */
import { proxyAnalyzerGet } from '@/lib/cardAnalyzer/serviceProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyAnalyzerGet('/metadata');
}
