/** Proxy: predictable years for one supported player (ascending). */
import { NextRequest } from 'next/server';
import { proxyAnalyzerGet } from '@/lib/cardAnalyzer/serviceProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyAnalyzerGet('/years', {
    player: req.nextUrl.searchParams.get('player'),
  });
}
