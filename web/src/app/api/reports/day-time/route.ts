import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTrades } from '@/lib/db/supabase';
import { calculateTradeCommission } from '@/lib/engine/commission';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';
import type { TradeDirection, TradeRecord } from '@/lib/types/trading';

type Group = 'days' | 'months' | 'trade-time' | 'trade-duration' | 'instruments';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Extract base instrument: "NIFTY25N1324150PE" → "NIFTY (Options)"
function getInstrument(t: TradeRecord): string {
  const sym: string = t.symbol || '';
  const segment: string = t.segment || '';

  // Equity — symbol is the instrument
  if (segment === 'EQ') return sym + ' (Equity)';

  // F&O — strip expiry/strike/type to get base
  // Remove expiry patterns like 25DEC, 26MAY, 25NOV, 25N13, 26N06 etc.
  let base = sym
    .replace(/\d{2}[A-Z]{3}FUT$/i, '')            // e.g., 25DECFUT
    .replace(/\d{2}[A-Z]{3}\d+[CP][E]$/i, '')     // e.g., 25NOV800CE (monthly options)
    .replace(/\d{2}\d{3}\d+[CP][E]$/i, '')         // e.g., 2520623600PE (day-of-year expiry)
    .replace(/\d{2}[A-Z]\d+[CP][E]$/i, '')         // e.g., 25N1324150PE (weekly options)
    .replace(/\d{2}[A-Z]{3}$/i, '')                // e.g., 25DEC
    .replace(/\d{2}[A-Z]\d+$/i, '');               // remaining expiry patterns

  if (!base) base = sym; // fallback

  const upper = sym.toUpperCase();
  if (upper.endsWith('FUT') || upper.includes('FUT')) return base + ' (Futures)';
  if (upper.endsWith('CE') || upper.endsWith('PE')) return base + ' (Options)';

  // Generic F&O fallback
  return base + ' (F&O)';
}

const DURATION_BUCKETS: { label: string; minMinutes: number; maxMinutes: number }[] = [
  { label: '<1m', minMinutes: 0, maxMinutes: 1 },
  { label: '1-1:59m', minMinutes: 1, maxMinutes: 2 },
  { label: '2-4:59m', minMinutes: 2, maxMinutes: 5 },
  { label: '5-9:59m', minMinutes: 5, maxMinutes: 10 },
  { label: '10-29:59m', minMinutes: 10, maxMinutes: 30 },
  { label: '30-59:59m', minMinutes: 30, maxMinutes: 60 },
  { label: '1-1:59h', minMinutes: 60, maxMinutes: 120 },
  { label: '2-3:59h', minMinutes: 120, maxMinutes: 240 },
  { label: '4h+', minMinutes: 240, maxMinutes: Infinity },
];

interface GroupStats {
  label: string;
  winPct: number;
  netPnl: number;
  tradeCount: number;
  avgWin: number;
  avgLoss: number;
  avgVolume: number;
}

function getDirection(direction: string | undefined): TradeDirection {
  return direction === 'SHORT' ? 'SHORT' : 'LONG';
}

function computeGroupStats(trades: TradeRecord[], getKey: (t: TradeRecord) => string): GroupStats[] {
  const groups: Record<string, TradeRecord[]> = {};
  for (const t of trades) {
    const key = getKey(t);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const stats: GroupStats[] = [];
  for (const [label, groupTrades] of Object.entries(groups)) {
    const wins = groupTrades.filter(t => t.result === 'win');
    const losses = groupTrades.filter(t => t.result === 'loss');
    const grossPnl = groupTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalCommission = groupTrades.reduce((s, t) => s + (t.commission || 0), 0);
    const netPnl = grossPnl - totalCommission;
    const tradeCount = groupTrades.length;
    const winPct = tradeCount > 0 ? (wins.length / tradeCount) * 100 : 0;
    const totalWins = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const avgVolume = tradeCount > 0
      ? groupTrades.reduce((s, t) => s + (t.quantity || 0), 0) / tradeCount
      : 0;

    stats.push({ label, winPct, netPnl, tradeCount, avgWin, avgLoss, avgVolume });
  }

  return stats;
}

function sortStats(stats: GroupStats[], group: Group): GroupStats[] {
  if (group === 'days') {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return stats.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }
  if (group === 'months') {
    return stats.sort((a, b) => MONTH_NAMES.indexOf(a.label) - MONTH_NAMES.indexOf(b.label));
  }
  if (group === 'trade-time') {
    return stats.sort((a, b) => parseInt(a.label) - parseInt(b.label));
  }
  // trade-duration: preserve bucket order
  if (group === 'trade-duration') {
    return stats.sort((a, b) => {
      const ai = DURATION_BUCKETS.findIndex(d => d.label === a.label);
      const bi = DURATION_BUCKETS.findIndex(d => d.label === b.label);
      return ai - bi;
    });
  }
  // instruments: sort by net PnL descending
  return stats.sort((a, b) => b.netPnl - a.netPnl);
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const group = (request.nextUrl.searchParams.get('group') || 'days') as Group;
    let trades = await fetchAllTrades(user.id);

    // Backfill commission for legacy trades
    trades = trades.map((t): TradeRecord => {
      if (t.commission !== undefined && t.commission !== null) return t;
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
      return { ...t, commission: commission.total };
    });

    if (!trades.length) {
      return NextResponse.json({
        groups: [],
        bestPerforming: null,
        leastPerforming: null,
        mostActive: null,
        bestWinRate: null,
      });
    }

    let getKey: (t: TradeRecord) => string;
    let labelFormatter: (key: string) => string;

    switch (group) {
      case 'days':
        getKey = (t) => {
          const ts = t.entry_time || t.entryTime || '';
          const d = new Date(ts.replace(' ', 'T'));
          return DAY_NAMES[d.getDay()];
        };
        labelFormatter = (k) => k;
        break;

      case 'months':
        getKey = (t) => {
          const ts = t.entry_time || t.entryTime || '';
          const d = new Date(ts.replace(' ', 'T'));
          return MONTH_NAMES[d.getMonth()];
        };
        labelFormatter = (k) => k;
        break;

      case 'trade-time':
        getKey = (t) => {
          const ts = t.entry_time || t.entryTime || '';
          const d = new Date(ts.replace(' ', 'T'));
          return String(d.getHours());
        };
        labelFormatter = (k) => {
          const h = parseInt(k);
          return `${String(h).padStart(2, '0')}:00`;
        };
        break;

      case 'trade-duration':
        getKey = (t) => {
          const entryStr = t.entry_time || t.entryTime || '';
          const exitStr = t.exit_time || t.exitTime || '';
          const entry = new Date(entryStr.replace(' ', 'T'));
          const exit = new Date(exitStr.replace(' ', 'T'));
          const minutes = (exit.getTime() - entry.getTime()) / 60000;
          const bucket = DURATION_BUCKETS.find(b => minutes >= b.minMinutes && minutes < b.maxMinutes);
          return bucket ? bucket.label : '4h+';
        };
        labelFormatter = (k) => k;
        break;

      case 'instruments':
        getKey = (t) => getInstrument(t);
        labelFormatter = (k) => k;
        break;

      default:
        return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
    }

    const rawStats = computeGroupStats(trades, getKey);
    const groups = sortStats(rawStats, group).map(g => ({
      ...g,
      label: labelFormatter(g.label),
    }));

    // Compute summary cards
    const bestPerforming = groups.length
      ? groups.reduce((best, g) => g.netPnl > best.netPnl ? g : best, groups[0])
      : null;

    const leastPerforming = groups.length
      ? groups.reduce((worst, g) => g.netPnl < worst.netPnl ? g : worst, groups[0])
      : null;

    const mostActive = groups.length
      ? groups.reduce((most, g) => g.tradeCount > most.tradeCount ? g : most, groups[0])
      : null;

    const bestWinRate = groups.length
      ? groups.reduce((best, g) => g.winPct > best.winPct ? g : best, groups[0])
      : null;

    return NextResponse.json({
      groups,
      bestPerforming: bestPerforming ? { ...bestPerforming } : null,
      leastPerforming: leastPerforming ? { ...leastPerforming } : null,
      mostActive: mostActive ? { ...mostActive } : null,
      bestWinRate: bestWinRate ? { ...bestWinRate } : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
