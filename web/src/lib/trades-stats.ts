export function computeStats(trades: any[]) {
  const zero = {
    netPnl: 0, tradeWinPct: 0, profitFactor: 0, dayWinPct: 0,
    avgWinLoss: 0, totalWins: 0, totalLosses: 0, avgWin: 0, avgLoss: 0,
    winCount: 0, lossCount: 0, greenDays: 0, redDays: 0,
    dayPnl: {} as Record<string, number>, dailyArr: [] as any[], cumulativeArr: [] as any[],
  };
  if (!trades.length) return zero;

  const wins   = trades.filter(t => t.result === 'win');
  const losses = trades.filter(t => t.result === 'loss');

  const netPnl      = trades.reduce((s, t) => s + t.pnl, 0);
  const totalWins   = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  const tradeWinPct  = wins.length / trades.length * 100;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
  const avgWin       = wins.length   > 0 ? totalWins   / wins.length   : 0;
  const avgLoss      = losses.length > 0 ? totalLosses / losses.length : 0;
  const avgWinLoss   = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999 : 0);

  const dayPnl: Record<string, number> = {};
  for (const t of trades) dayPnl[t.trade_date || t.date] = (dayPnl[t.trade_date || t.date] || 0) + t.pnl;

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
    greenDays, redDays, dayPnl, dailyArr, cumulativeArr,
  };
}

export function filterTradesByTime(trades: any[], filter: string) {
  if (filter === 'All Time') return trades;
  const now = new Date();

  return trades.filter(t => {
    const timeStr = t.entry_time || t.entryTime;
    const dateStr = t.trade_date || t.date;
    const d = new Date(timeStr.replace(' ', 'T'));
    
    switch (filter) {
      case 'Today':        return dateStr === now.toISOString().split('T')[0];
      case 'This Week':    { const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0,0,0,0); return d >= ws; }
      case 'This Month':   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'Last 30 Days': { const ago = new Date(now); ago.setDate(now.getDate() - 30); return d >= ago; }
      case 'Last Month':   { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }
      case 'Quarter':      { const qs = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); return d >= qs; }
      case 'YTD':          return d.getFullYear() === now.getFullYear();
      default:             return true;
    }
  });
}
