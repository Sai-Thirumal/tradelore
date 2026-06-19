import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTrades, fetchAllTradeJournals, fetchPlaybooks } from '@/lib/db/supabase';
import { withCurrentCommission } from '@/lib/engine/commission';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';
import type { TradeRecord } from '@/lib/types/trading';

type Group = 'days' | 'months' | 'trade-time' | 'trade-duration' | 'instruments' | 'deployed-capital' | 'playbooks' | 'options-expiry';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_CODES: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5,
  '7': 6, '8': 7, '9': 8, O: 9, N: 10, D: 11,
};
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;
const MARKET_SESSION_MINUTES = MARKET_CLOSE_MINUTES - MARKET_OPEN_MINUTES;
const TRADING_DAYS_PER_WEEK = 5;
const TRADING_DAYS_PER_MONTH = 21;

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

interface CapitalBucket {
  label: string;
  min: number;
  max: number;
}

interface GroupStats {
  label: string;
  winPct: number;
  netPnl: number;
  tradeCount: number;
  avgWin: number;
  avgLoss: number;
  avgVolume: number;
}

function formatCompactCapital(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const format = (n: number) => Number(n.toFixed(2)).toString();

  if (abs >= 10000000) return `${sign}${format(abs / 10000000)}Cr`;
  if (abs >= 100000) return `${sign}${format(abs / 100000)}L`;
  if (abs >= 1000) return `${sign}${format(abs / 1000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function chooseCapitalStep(range: number): number {
  if (range <= 0) return 1;
  const targetBuckets = 16;
  const rawStep = range / targetBuckets;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const multipliers = [1, 2, 2.5, 5, 10];
  const multiplier = multipliers.find((m) => normalized <= m) || 10;
  return multiplier * magnitude;
}

function buildCapitalBuckets(values: number[]): CapitalBucket[] {
  if (!values.length) return [];

  const minCapital = Math.min(...values);
  const maxCapital = Math.max(...values);

  if (minCapital === maxCapital) {
    const label = formatCompactCapital(minCapital);
    return [{ label, min: minCapital, max: maxCapital }];
  }

  const step = chooseCapitalStep(maxCapital - minCapital);
  const lower = Math.floor(minCapital / step) * step;
  const upper = Math.ceil(maxCapital / step) * step;
  const bucketCount = Math.max(1, Math.ceil((upper - lower) / step));
  const buckets: CapitalBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const min = lower + i * step;
    const max = i === bucketCount - 1 ? upper : lower + (i + 1) * step;
    buckets.push({
      min,
      max,
      label: `${formatCompactCapital(min)} - ${formatCompactCapital(max)}`,
    });
  }

  return buckets;
}

function getDeployedCapital(t: TradeRecord): number {
  const entryPrice = Number(t.avg_entry || t.avgEntry || 0);
  const quantity = Number(t.qty || t.quantity || 0);
  const deployedCapital = Math.abs(entryPrice * quantity);
  return Number.isFinite(deployedCapital) ? deployedCapital : 0;
}

function parseDateParts(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!year || month < 0 || month > 11 || !day) return null;

  return new Date(year, month, day);
}

function parseDateTime(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const date = parseDateParts(`${match[1]}-${match[2]}-${match[3]}`);
  if (!date) return null;

  date.setHours(Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0), 0);
  return date;
}

function toExpiryClose(date: Date): Date {
  const expiry = new Date(date);
  expiry.setHours(Math.floor(MARKET_CLOSE_MINUTES / 60), MARKET_CLOSE_MINUTES % 60, 0, 0);
  return expiry;
}

function getLastThursday(year: number, month: number): Date {
  const date = new Date(year, month + 1, 0);
  while (date.getDay() !== 4) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

function parseSymbolExpiry(symbol: string): Date | null {
  const upper = symbol.toUpperCase();
  if (!/(CE|PE)$/.test(upper)) return null;

  const weekly = upper.match(/(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/);
  if (weekly) {
    const year = 2000 + Number(weekly[1]);
    const month = MONTH_CODES[weekly[2]];
    const day = Number(weekly[3]);
    if (month === undefined || !day) return null;
    return new Date(year, month, day);
  }

  const monthly = upper.match(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+(?:\.\d+)?)(CE|PE)$/);
  if (monthly) {
    const year = 2000 + Number(monthly[1]);
    const month = MONTH_CODES[monthly[2]];
    if (month === undefined) return null;
    return getLastThursday(year, month);
  }

  return null;
}

function getExpiryDate(t: TradeRecord): Date | null {
  const importedExpiry = t.expiry_date ? parseDateParts(t.expiry_date) : null;
  return importedExpiry || parseSymbolExpiry(t.symbol || '');
}

function isOptionTrade(t: TradeRecord): boolean {
  if ((t.segment || '').toUpperCase() === 'EQ') return false;
  return /(CE|PE)$/i.test(t.symbol || '');
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function marketMinutesBetween(start: Date, end: Date): number {
  if (end <= start) return 0;

  let total = 0;
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= endDay) {
    if (!isWeekend(cursor)) {
      const sessionStart = new Date(cursor);
      sessionStart.setHours(Math.floor(MARKET_OPEN_MINUTES / 60), MARKET_OPEN_MINUTES % 60, 0, 0);

      const sessionEnd = new Date(cursor);
      sessionEnd.setHours(Math.floor(MARKET_CLOSE_MINUTES / 60), MARKET_CLOSE_MINUTES % 60, 0, 0);

      const rangeStart = start > sessionStart ? start : sessionStart;
      const rangeEnd = end < sessionEnd ? end : sessionEnd;
      if (rangeEnd > rangeStart) {
        total += (rangeEnd.getTime() - rangeStart.getTime()) / 60000;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return total;
}

function getExpiryBucketKey(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  let order: number;
  let label: string;

  if (safeMinutes < 60) {
    order = Math.floor(safeMinutes / 10) * 10;
    label = `${order}m`;
  } else if (safeMinutes < MARKET_SESSION_MINUTES) {
    const hours = Math.floor(safeMinutes / 60);
    order = hours * 60;
    label = `${hours}h`;
  } else if (safeMinutes < MARKET_SESSION_MINUTES * TRADING_DAYS_PER_WEEK) {
    const days = Math.floor(safeMinutes / MARKET_SESSION_MINUTES);
    order = days * MARKET_SESSION_MINUTES;
    label = `${days}D`;
  } else if (safeMinutes < MARKET_SESSION_MINUTES * TRADING_DAYS_PER_MONTH) {
    const weeks = Math.floor(safeMinutes / (MARKET_SESSION_MINUTES * TRADING_DAYS_PER_WEEK));
    order = weeks * MARKET_SESSION_MINUTES * TRADING_DAYS_PER_WEEK;
    label = `${weeks}W`;
  } else {
    const months = Math.floor(safeMinutes / (MARKET_SESSION_MINUTES * TRADING_DAYS_PER_MONTH));
    order = months * MARKET_SESSION_MINUTES * TRADING_DAYS_PER_MONTH;
    label = `${months}M`;
  }

  return `${order}|${label}`;
}

function buildTradeLookup(trades: TradeRecord[]): Map<string, TradeRecord> {
  const tradeById = new Map<string, TradeRecord>();
  for (const trade of trades) {
    if (trade.id) tradeById.set(trade.id, trade);
    if (trade.symbol && trade.entry_time) {
      tradeById.set(`${trade.symbol}_${trade.entry_time}`, trade);
    }
  }
  return tradeById;
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
  if (group === 'deployed-capital') {
    return stats;
  }
  if (group === 'playbooks') {
    return stats.sort((a, b) => b.netPnl - a.netPnl);
  }
  if (group === 'options-expiry') {
    return stats.sort((a, b) => Number(a.label.split('|')[0]) - Number(b.label.split('|')[0]));
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

    trades = trades.map((t): TradeRecord => withCurrentCommission(t));

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
    let groupedTrades = trades;

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

      case 'deployed-capital': {
        groupedTrades = trades.filter((t) => getDeployedCapital(t) > 0);
        const capitalValues = groupedTrades.map(getDeployedCapital);
        const buckets = buildCapitalBuckets(capitalValues);

        getKey = (t) => {
          const capital = getDeployedCapital(t);
          const idx = buckets.findIndex((bucket, i) => {
            const isLast = i === buckets.length - 1;
            return capital >= bucket.min && (capital < bucket.max || (isLast && capital <= bucket.max));
          });
          return idx >= 0 ? String(idx) : 'unbucketed';
        };
        labelFormatter = (k) => buckets[Number(k)]?.label || k;
        break;
      }

      case 'playbooks': {
        const [journals, playbooks] = await Promise.all([
          fetchAllTradeJournals(user.id),
          fetchPlaybooks(user.id),
        ]);
        const tradeById = buildTradeLookup(trades);
        const playbookByTrade = new Map<TradeRecord, string>();
        const playbookNameById = new Map(
          playbooks
            .filter((playbook) => playbook.id)
            .map((playbook) => [playbook.id as string, playbook.name || 'Untitled playbook']),
        );

        for (const journal of journals) {
          const playbookId = (journal.playbook_id || '').trim();
          if (!playbookId) continue;

          const trade = tradeById.get(journal.trade_id);
          if (!trade) continue;

          playbookByTrade.set(trade, playbookId);
        }

        groupedTrades = trades.filter((t) => playbookByTrade.has(t));
        getKey = (t) => playbookByTrade.get(t) || 'untagged';
        labelFormatter = (k) => playbookNameById.get(k) || `Unknown playbook (${k.slice(0, 8)})`;
        break;
      }

      case 'options-expiry':
        groupedTrades = trades.filter((t) => {
          const entry = parseDateTime(t.entry_time || t.entryTime || '');
          const expiry = getExpiryDate(t);
          return isOptionTrade(t) && entry && expiry;
        });
        getKey = (t) => {
          const entry = parseDateTime(t.entry_time || t.entryTime || '');
          const expiry = getExpiryDate(t);
          if (!entry || !expiry) return 'unavailable';
          return getExpiryBucketKey(marketMinutesBetween(entry, toExpiryClose(expiry)));
        };
        labelFormatter = (k) => k.split('|')[1] || k;
        break;

      default:
        return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
    }

    const rawStats = computeGroupStats(groupedTrades, getKey);
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
