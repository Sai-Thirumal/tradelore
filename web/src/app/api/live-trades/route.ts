import { NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { fetchAllOrders } from '@/lib/db/supabase';
import { findOpenTrades } from '@/lib/engine/trade-matcher';
import { internalErrorResponse } from '@/lib/errors';

const LIVE_EXCHANGES = new Set(['NSE', 'BSE', 'MCX']);

export async function GET() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    const openTrades = findOpenTrades(await fetchAllOrders(user.id))
      .filter((trade) => LIVE_EXCHANGES.has((trade.exchange || '').toUpperCase()));

    return NextResponse.json(openTrades);
  } catch (error: unknown) {
    return internalErrorResponse(error, 'Unable to load live trades.');
  }
}
