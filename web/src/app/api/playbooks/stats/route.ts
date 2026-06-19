import { NextResponse } from 'next/server';
import { fetchAllTrades, fetchAllTradeJournals } from '@/lib/db/supabase';
import { withCurrentCommission } from '@/lib/engine/commission';
import { requireAuthUser } from '@/lib/auth/session';
import { errorMessageIncludes, getErrorMessage, hasErrorCode } from '@/lib/errors';
import type { TradeRecord } from '@/lib/types/trading';

interface PlaybookStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_rr: number;
  total_pnl: number;
  net_pnl: number;
  total_commission: number;
  max_consecutive_losses: number;
}

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const [trades, journals] = await Promise.all([
      fetchAllTrades(user.id),
      fetchAllTradeJournals(user.id),
    ]);

    const enrichedTrades = trades.map((t): TradeRecord => withCurrentCommission(t));

    // Build lookup maps for trades by both UUID id and computed id
    const tradeById = new Map<string, TradeRecord>();
    const tradeByComputed = new Map<string, TradeRecord>();
    for (const t of enrichedTrades) {
      if (t.id) tradeById.set(t.id, t);
      const computed = `${t.symbol}_${t.entry_time}`;
      tradeByComputed.set(computed, t);
    }

    // Group journals by playbook_id
    const playbookTrades: Record<string, { pnl: number; commission: number; result: string; risk: number }[]> = {};

    for (const j of journals) {
      const pbId = j.playbook_id;
      if (!pbId) continue;

      // Match journal to trade
      const trade = tradeById.get(j.trade_id) || tradeByComputed.get(j.trade_id);
      if (!trade) continue;

      if (!playbookTrades[pbId]) playbookTrades[pbId] = [];
      playbookTrades[pbId].push({
        pnl: trade.pnl || 0,
        commission: trade.commission || 0,
        result: trade.result || 'breakeven',
        risk: Number(j.risk_amount || 0),
      });
    }

    // Compute stats per playbook
    const stats: Record<string, PlaybookStats> = {};
    for (const [pbId, entries] of Object.entries(playbookTrades)) {
      const wins = entries.filter(e => e.result === 'win').length;
      const losses = entries.filter(e => e.result === 'loss').length;
      const total = entries.length;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);
      const totalCommission = entries.reduce((s, e) => s + e.commission, 0);
      const netPnl = totalPnl - totalCommission;

      // Average R:R = average of (actual P&L / risk) — only for trades with risk data
      const rrValues = entries
        .filter(e => e.risk > 0)
        .map(e => e.pnl / e.risk);
      const avgRR = rrValues.length > 0
        ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length
        : 0;

      // Max consecutive losses
      let maxConsec = 0;
      let currentStreak = 0;
      for (const e of entries) {
        if (e.result === 'loss') {
          currentStreak++;
          maxConsec = Math.max(maxConsec, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      stats[pbId] = {
        total_trades: total,
        wins,
        losses,
        win_rate: winRate,
        avg_rr: Math.round(avgRR * 10) / 10,
        total_pnl: totalPnl,
        net_pnl: netPnl,
        total_commission: totalCommission,
        max_consecutive_losses: maxConsec,
      };
    }

    return NextResponse.json(stats);
  } catch (error: unknown) {
    // Handle missing tables gracefully for preview deploys
    if (errorMessageIncludes(error, 'relation') || hasErrorCode(error, '42P01')) {
      return NextResponse.json({});
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
