import { NextResponse } from 'next/server';
import { fetchAllTrades } from '@/lib/db/supabase';
import { withCurrentCommission } from '@/lib/engine/commission';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { internalErrorResponse } from '@/lib/errors';
import type { TradeRecord } from '@/lib/types/trading';

export async function GET() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    const trades = await fetchAllTrades(user.id);

    const enrichedTrades = trades.map((t): TradeRecord => withCurrentCommission(t));

    return NextResponse.json(enrichedTrades);
  } catch (error: unknown) {
    return internalErrorResponse(error, 'Unable to load trades.');
  }
}
