import type { TradeRecord } from '../types/trading.ts';
import { KNOWN_BROKER_IDS, type KnownBrokerId } from '../brokers/core/types.ts';
import { isMcxInstrument } from './mcx.ts';

export type BrokerFilter = 'all' | KnownBrokerId;
export type SegmentFilter = 'all' | 'equity' | 'fo' | 'mcx' | 'delta_perp' | 'delta_futures' | 'delta_options';

export function getTradeBroker(trade: Pick<TradeRecord, 'broker'>): KnownBrokerId {
  const broker = (trade.broker || 'zerodha').trim().toLowerCase();
  return (KNOWN_BROKER_IDS as readonly string[]).includes(broker) ? broker as KnownBrokerId : 'zerodha';
}

export function getTradeCurrency(trade: Pick<TradeRecord, 'broker' | 'pnl_currency' | 'settlement_asset'>): string {
  const currency = (trade.pnl_currency || trade.settlement_asset || '').trim().toUpperCase();
  if (currency) return currency;
  return getTradeBroker(trade) === 'delta' ? 'NATIVE' : 'INR';
}

export function getScopeCurrency(trades: Pick<TradeRecord, 'broker' | 'pnl_currency' | 'settlement_asset'>[]): string {
  const currencies = Array.from(new Set(trades.map(getTradeCurrency)));
  if (currencies.length === 0) return 'INR';
  return currencies.length === 1 ? currencies[0] : 'MIXED';
}

export function getTradeSegmentBucket(trade: TradeRecord): SegmentFilter {
  const broker = getTradeBroker(trade);
  const segment = (trade.segment || '').toUpperCase();
  const contractType = (trade.contract_type || '').toUpperCase();

  if (broker === 'delta') {
    if (segment.includes('PERP') || contractType.includes('PERPETUAL')) return 'delta_perp';
    if (segment.includes('CALL') || segment.includes('PUT') || contractType.includes('CALL') || contractType.includes('PUT') || contractType.includes('OPTION')) {
      return 'delta_options';
    }
    return 'delta_futures';
  }

  if (isMcxInstrument(trade)) return 'mcx';
  if (segment === 'EQ') return 'equity';
  return 'fo';
}

export function filterTradesForScope(trades: TradeRecord[], broker: BrokerFilter = 'all', segment: SegmentFilter | SegmentFilter[] = 'all'): TradeRecord[] {
  const segments = Array.isArray(segment) ? segment : [segment];
  return trades.filter((trade) => {
    if (broker !== 'all' && getTradeBroker(trade) !== broker) return false;
    if (!segments.includes('all') && !segments.includes(getTradeSegmentBucket(trade))) return false;
    return true;
  });
}

export function getTradeInstrumentLabel(trade: TradeRecord): string {
  if (getTradeBroker(trade) === 'delta') return trade.product_symbol || trade.symbol || '';
  return trade.symbol || '';
}

function deltaBaseSymbol(symbol: string) {
  return symbol.replace(/(?:USDT|USD|INR)$/i, '') || symbol;
}

export function getDeltaInstrumentFamilyLabel(trade: TradeRecord): string {
  const symbol = (trade.product_symbol || trade.symbol || '').toUpperCase();
  const option = symbol.match(/^[CP]-([A-Z0-9]+)-/);
  if (option) return `${option[1]} Options`;

  const base = deltaBaseSymbol(symbol);
  const segment = getTradeSegmentBucket(trade);
  if (segment === 'delta_perp') return `${base} Perpetuals`;
  if (segment === 'delta_options') return `${base} Options`;
  return `${base} Futures`;
}
