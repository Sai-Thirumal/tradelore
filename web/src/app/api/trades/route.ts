import { NextResponse } from 'next/server';
import { fetchAllTrades } from '@/lib/db/supabase';
import { calculateTradeCommission } from '@/lib/engine/commission';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';
import type { TradeDirection, TradeRecord } from '@/lib/types/trading';

function getDirection(direction: string | undefined): TradeDirection {
  return direction === 'SHORT' ? 'SHORT' : 'LONG';
}

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const trades = await fetchAllTrades(user.id);

    // Backfill commission for trades that don't have it stored
    const enrichedTrades = trades.map((t): TradeRecord => {
      if (t.commission !== undefined && t.commission !== null) {
        return t;
      }
      // Compute commission on-the-fly for legacy trades
      const commission = calculateTradeCommission({
        symbol: t.symbol || '',
        exchange: t.exchange || '',
        segment: t.segment || '',
        direction: getDirection(t.direction),
        qty: t.qty || 0,
        avg_entry: t.avg_entry || 0,
        avg_exit: t.avg_exit || 0,
        entry_time: t.entry_time || t.entryTime || '',
        exit_time: t.exit_time || t.exitTime || '',
      });
      return {
        ...t,
        commission: commission.total,
        commission_breakdown: commission,
      };
    });

    return NextResponse.json(enrichedTrades);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
