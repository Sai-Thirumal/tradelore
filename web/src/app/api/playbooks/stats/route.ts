import { NextResponse } from 'next/server';
import { fetchAllTrades, fetchAllTradeJournals } from '@/lib/db/supabase';

export async function GET() {
  try {
    const [trades, journals] = await Promise.all([
      fetchAllTrades(),
      fetchAllTradeJournals(),
    ]);

    // Build lookup maps for trades by both UUID id and computed id
    const tradeById = new Map<string, any>();
    const tradeByComputed = new Map<string, any>();
    for (const t of trades) {
      if (t.id) tradeById.set(t.id, t);
      const computed = `${t.symbol}_${t.entry_time}`;
      tradeByComputed.set(computed, t);
    }

    // Group journals by playbook_id
    const playbookTrades: Record<string, { pnl: number; result: string; risk: number }[]> = {};

    for (const j of journals) {
      const pbId = j.playbook_id;
      if (!pbId) continue;

      // Match journal to trade
      let trade = tradeById.get(j.trade_id) || tradeByComputed.get(j.trade_id);
      if (!trade) continue;

      if (!playbookTrades[pbId]) playbookTrades[pbId] = [];
      playbookTrades[pbId].push({
        pnl: trade.pnl || 0,
        result: trade.result || 'breakeven',
        risk: parseFloat(j.risk_amount) || 0,
      });
    }

    // Compute stats per playbook
    const stats: Record<string, any> = {};
    for (const [pbId, entries] of Object.entries(playbookTrades)) {
      const wins = entries.filter(e => e.result === 'win').length;
      const losses = entries.filter(e => e.result === 'loss').length;
      const total = entries.length;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);

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
        max_consecutive_losses: maxConsec,
      };
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    // Handle missing tables gracefully for preview deploys
    if (error?.message?.includes('relation') || error?.code === '42P01') {
      return NextResponse.json({});
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
