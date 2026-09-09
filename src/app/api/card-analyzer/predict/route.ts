/**
 * Proxy: predict one EXACT card-grade identity (Model V4).
 *
 * Forwards ONLY the three known fields — the grade_uid selected by the user,
 * the optional purchase amount, and the holding period. A pass-through of the
 * raw body would let a caller smuggle extra keys toward the service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyAnalyzerPost } from '@/lib/cardAnalyzer/serviceProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', detail: 'Request body must be JSON.' },
      { status: 400 },
    );
  }
  const body = payload as Record<string, unknown>;
  return proxyAnalyzerPost('/predict', {
    grade_uid: body.grade_uid,
    purchase_amount: body.purchase_amount ?? null,
    holding_period_days: body.holding_period_days ?? 7,
  });
}
