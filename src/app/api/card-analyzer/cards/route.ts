/** Proxy: predictable, qualifier-free exact card-grade identities. */
import { NextRequest } from 'next/server';
import { proxyAnalyzerGet } from '@/lib/cardAnalyzer/serviceProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyAnalyzerGet('/cards', {
    player: req.nextUrl.searchParams.get('player'),
    year: req.nextUrl.searchParams.get('year'),
  });
}
