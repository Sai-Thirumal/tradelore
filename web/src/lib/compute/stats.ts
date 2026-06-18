import type { TradeRecord } from '@/lib/types/trading';

interface DailyPnlPoint {
  date: string;
  pnl: number;
}

export interface StatsResult {
  netPnl: number;
  tradeWinPct: number;
  profitFactor: number;
  dayWinPct: number;
  avgWinLoss: number;
  totalWins: number;
  totalLosses: number;
  avgWin: number;
  avgLoss: number;
  winCount: number;
  lossCount: number;
  greenDays: number;
  redDays: number;
  dayPnl: Record<string, number>;
  dayTrades: Record<string, number>;
  dailyArr: DailyPnlPoint[];
  cumulativeArr: DailyPnlPoint[];
}

export function computeStats(trades: TradeRecord[]): StatsResult {
  const zero = {
    netPnl: 0, tradeWinPct: 0, profitFactor: 0, dayWinPct: 0,
    avgWinLoss: 0, totalWins: 0, totalLosses: 0, avgWin: 0, avgLoss: 0,
    winCount: 0, lossCount: 0, greenDays: 0, redDays: 0,
    dayPnl: {} as Record<string, number>, dayTrades: {} as Record<string, number>,
    dailyArr: [] as DailyPnlPoint[], cumulativeArr: [] as DailyPnlPoint[],
  };
  if (!trades.length) return zero;

  const wins   = trades.filter(t => t.result === 'win');
  const losses = trades.filter(t => t.result === 'loss');

  const grossPnl      = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalCommission = trades.reduce((s, t) => s + (t.commission || 0), 0);
  const netPnl        = grossPnl - totalCommission;

  const totalWins   = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));

  const tradeWinPct  = wins.length / trades.length * 100;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
  const avgWin       = wins.length   > 0 ? totalWins   / wins.length   : 0;
  const avgLoss      = losses.length > 0 ? totalLosses / losses.length : 0;
  const avgWinLoss   = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999 : 0);

  const dayPnl: Record<string, number> = {};
  const dayTrades: Record<string, number> = {};
  for (const t of trades) {
    const date = t.trade_date || t.date || '';
    if (!date) continue;
    const tradeNet = (t.pnl || 0) - (t.commission || 0);
    dayPnl[date] = (dayPnl[date] || 0) + tradeNet;
    dayTrades[date] = (dayTrades[date] || 0) + 1;
  }

  const sortedDays = Object.keys(dayPnl).sort();
  const greenDays  = sortedDays.filter(d => dayPnl[d] > 0).length;
  const redDays    = sortedDays.filter(d => dayPnl[d] <= 0).length;
  const dayWinPct  = sortedDays.length > 0 ? (greenDays / sortedDays.length * 100) : 0;

  const dailyArr = sortedDays.map(d => ({ date: d, pnl: dayPnl[d] }));
  let cumSum = 0;
  const cumulativeArr = dailyArr.map(({ date, pnl }) => { cumSum += pnl; return { date, pnl: cumSum }; });

  return {
    netPnl, tradeWinPct, profitFactor, dayWinPct, avgWinLoss,
    totalWins, totalLosses, avgWin, avgLoss,
    winCount: wins.length, lossCount: losses.length,
    greenDays, redDays, dayPnl, dayTrades, dailyArr, cumulativeArr,
  };
}

export function filterTradesByDateRange(trades: TradeRecord[], start: string, end: string) {
  if (!start && !end) return trades;
  const s = start ? new Date(start + 'T00:00:00') : null;
  const e = end ? new Date(end + 'T23:59:59') : null;

  return trades.filter(t => {
    const timeStr = t.entry_time || t.entryTime || '';
    if (!timeStr) return false;
    const d = new Date(timeStr.replace(' ', 'T'));
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  });
}
