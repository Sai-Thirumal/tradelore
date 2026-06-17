import { NextResponse } from 'next/server';
import { fetchAllTrades, fetchAllTradeJournals } from '@/lib/db/supabase';
import { calculateTradeCommission } from '@/lib/engine/commission';
import { requireAuthUser } from '@/lib/auth/session';

interface OverviewStats {
  // Trade counts
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;

  // P&L
  netPnl: number;
  largestProfit: number;
  largestLoss: number;
  avgTradePnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;

  // Consecutive
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Hold times
  avgHoldTimeAll: number;    // minutes
  avgHoldTimeWins: number;
  avgHoldTimeLosses: number;

  // Volume
  avgDailyVolume: number;

  // Days
  totalTradingDays: number;
  winningDays: number;
  losingDays: number;
  breakevenDays: number;
  loggedDays: number;

  // Day P&L
  avgDailyPnl: number;
  avgWinningDayPnl: number;
  avgLosingDayPnl: number;
  largestProfitableDay: number;
  largestLosingDay: number;

  // Consecutive days
  maxConsecutiveWinningDays: number;
  maxConsecutiveLosingDays: number;

  // Drawdown
  maxDrawdown: number;
  avgDrawdown: number;

  // R-multiple (from journal)
  avgPlannedR: number | null;
  avgRealisedR: number | null;

  // Misc
  totalCommissions: number;
  openTrades: number;
}

function getHoldMinutes(entryTime: string, exitTime: string): number {
  const entry = new Date(entryTime.replace(' ', 'T'));
  const exit = new Date(exitTime.replace(' ', 'T'));
  return (exit.getTime() - entry.getTime()) / 60000;
}

function maxConsecutive(arr: boolean[], target: boolean): number {
  let max = 0, cur = 0;
  for (const v of arr) {
    if (v === target) { cur++; max = Math.max(max, cur); }
    else { cur = 0; }
  }
  return max;
}

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    let trades = await fetchAllTrades(user.id);
    const journals = await fetchAllTradeJournals(user.id);

    // Backfill commission for legacy trades
    trades = trades.map((t: any) => {
      if (t.commission !== undefined && t.commission !== null) return t;
      const commission = calculateTradeCommission({
        symbol: t.symbol || '',
        exchange: t.exchange || '',
        segment: t.segment || '',
        direction: t.direction || 'LONG',
        qty: t.qty || 0,
        avg_entry: t.avg_entry || 0,
        avg_exit: t.avg_exit || 0,
        entry_time: t.entry_time || t.entryTime || '',
        exit_time: t.exit_time || t.exitTime || '',
      });
      return { ...t, commission: commission.total };
    });

    if (!trades.length) {
      return NextResponse.json(null);
    }

    // Sort trades by entry time for consecutive calculations
    const sorted = [...trades].sort((a, b) => {
      const ae = (a.entry_time || a.entryTime || '').replace(' ', 'T');
      const be = (b.entry_time || b.entryTime || '').replace(' ', 'T');
      return ae.localeCompare(be);
    });

    const wins = sorted.filter(t => t.result === 'win');
    const losses = sorted.filter(t => t.result === 'loss');
    const breakevens = sorted.filter(t => t.result === 'breakeven');

    const grossPnl = sorted.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalCommission = sorted.reduce((s, t) => s + (t.commission || 0), 0);
    const netPnl = grossPnl - totalCommission;
    const totalWins = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));

    // Consecutive wins/losses
    const winLossArr = sorted.map(t => t.result === 'win');
    const lossArr = sorted.map(t => t.result === 'loss');
    const maxConsecutiveWins = maxConsecutive(winLossArr, true);
    const maxConsecutiveLosses = maxConsecutive(lossArr, true);

    // Largest profit/loss
    const largestProfit = sorted.reduce((max, t) => t.pnl > max ? t.pnl : max, 0);
    const largestLoss = sorted.reduce((min, t) => t.pnl < min ? t.pnl : min, 0);

    // Hold times
    const holdTimes = sorted.map(t => getHoldMinutes(t.entry_time || t.entryTime, t.exit_time || t.exitTime));
    const holdTimesWins = wins.map(t => getHoldMinutes(t.entry_time || t.entryTime, t.exit_time || t.exitTime));
    const holdTimesLosses = losses.map(t => getHoldMinutes(t.entry_time || t.entryTime, t.exit_time || t.exitTime));
    const avgHoldTimeAll = holdTimes.reduce((s, m) => s + m, 0) / holdTimes.length;
    const avgHoldTimeWins = holdTimesWins.length ? holdTimesWins.reduce((s, m) => s + m, 0) / holdTimesWins.length : 0;
    const avgHoldTimeLosses = holdTimesLosses.length ? holdTimesLosses.reduce((s, m) => s + m, 0) / holdTimesLosses.length : 0;

    // Average daily volume
    const avgDailyVolume = sorted.reduce((s, t) => s + (t.qty || 0), 0) / sorted.length;

    // Day-level stats
    const dayPnl: Record<string, number> = {};
    const dayTrades: Record<string, number> = {};
    for (const t of sorted) {
      const d = t.trade_date || t.date;
      dayPnl[d] = (dayPnl[d] || 0) + (t.pnl || 0);
      dayTrades[d] = (dayTrades[d] || 0) + 1;
    }

    const sortedDays = Object.keys(dayPnl).sort();
    const totalTradingDays = sortedDays.length;
    const winningDays = sortedDays.filter(d => dayPnl[d] > 0).length;
    const losingDays = sortedDays.filter(d => dayPnl[d] < 0).length;
    const breakevenDays = sortedDays.filter(d => dayPnl[d] === 0).length;

    // Consecutive winning/losing days
    const dayWinArr = sortedDays.map(d => dayPnl[d] > 0);
    const dayLossArr = sortedDays.map(d => dayPnl[d] < 0);
    const maxConsecutiveWinningDays = maxConsecutive(dayWinArr, true);
    const maxConsecutiveLosingDays = maxConsecutive(dayLossArr, true);

    // Day P&L stats
    const dayValues = sortedDays.map(d => dayPnl[d]);
    const positiveDays = dayValues.filter(v => v > 0);
    const negativeDays = dayValues.filter(v => v < 0);

    const avgDailyPnl = dayValues.reduce((s, v) => s + v, 0) / totalTradingDays;
    const avgWinningDayPnl = positiveDays.length ? positiveDays.reduce((s, v) => s + v, 0) / positiveDays.length : 0;
    const avgLosingDayPnl = negativeDays.length ? negativeDays.reduce((s, v) => s + v, 0) / negativeDays.length : 0;
    const largestProfitableDay = positiveDays.length ? Math.max(...positiveDays) : 0;
    const largestLosingDay = negativeDays.length ? Math.min(...negativeDays) : 0;

    // Drawdown from cumulative PnL
    let cumSum = 0;
    let peak = 0;
    const drawdowns: number[] = [];
    for (const v of dayValues) {
      cumSum += v;
      if (cumSum > peak) peak = cumSum;
      const dd = peak - cumSum;
      drawdowns.push(dd);
    }
    const maxDrawdown = Math.max(...drawdowns, 0);
    const avgDrawdown = drawdowns.reduce((s, d) => s + d, 0) / drawdowns.length;

    // Logged days (from trade_journal)
    const loggedDates = new Set(journals.map((j: any) => {
      // Extract date from trade_id or journal date
      const tid = j.trade_id || '';
      // Match a trade to get its date
      const trade = trades.find((t: any) => t.id === tid);
      return trade ? (trade.trade_date || trade.date) : '';
    }).filter(Boolean));
    const loggedDays = loggedDates.size;

    // R-multiple from journal entries
    const journalEntries = journals.filter((j: any) => j.risk_amount && j.risk_amount > 0);
    let avgPlannedR: number | null = null;
    let avgRealisedR: number | null = null;

    if (journalEntries.length > 0) {
      const rValues: number[] = [];
      journalEntries.forEach((j: any) => {
        const trade = trades.find((t: any) => t.id === j.trade_id);
        if (trade && j.risk_amount > 0) {
          // Realised R = pnl / risk_amount
          const realisedR = (trade.pnl || 0) / j.risk_amount;
          rValues.push(realisedR);

          // Planned R from profit_target fields if available
        }
      });
      if (rValues.length > 0) {
        avgRealisedR = rValues.reduce((s, v) => s + v, 0) / rValues.length;
      }
    }

    // Planned R — from profit_target fields
    const plannedEntries = journals.filter((j: any) => {
      const entry = j.profit_target_entry || 0;
      const exit = j.profit_target_exit || 0;
      const risk = j.risk_amount || 0;
      return entry && exit && risk > 0;
    });

    if (plannedEntries.length > 0) {
      const plannedRValues = plannedEntries.map((j: any) => {
        const entry = j.profit_target_entry || 0;
        const exit = j.profit_target_exit || 0;
        const risk = j.risk_amount || 1;
        // Planned R = (target - entry) / risk? Simple: profit_target / risk
        return Math.abs(exit - entry) / risk;
      });
      avgPlannedR = plannedRValues.reduce((s, v) => s + v, 0) / plannedRValues.length;
    }

    const stats: OverviewStats = {
      totalTrades: sorted.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      breakevenTrades: breakevens.length,

      netPnl,
      largestProfit,
      largestLoss,
      avgTradePnl: netPnl / sorted.length,
      avgWin: wins.length ? totalWins / wins.length : 0,
      avgLoss: losses.length ? totalLosses / losses.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0),

      maxConsecutiveWins,
      maxConsecutiveLosses,

      avgHoldTimeAll,
      avgHoldTimeWins,
      avgHoldTimeLosses,

      avgDailyVolume,

      totalTradingDays,
      winningDays,
      losingDays,
      breakevenDays,
      loggedDays,

      avgDailyPnl,
      avgWinningDayPnl,
      avgLosingDayPnl,
      largestProfitableDay,
      largestLosingDay,

      maxConsecutiveWinningDays,
      maxConsecutiveLosingDays,

      maxDrawdown,
      avgDrawdown,

      avgPlannedR,
      avgRealisedR,

      totalCommissions: totalCommission,
      openTrades: 0,       // no open trades concept yet
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
