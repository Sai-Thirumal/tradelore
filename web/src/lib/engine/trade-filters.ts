import type { TradeRecord } from '../types/trading.ts';
import { isMcxInstrument } from './mcx.ts';

export type BrokerFilter = 'all' | 'zerodha' | 'delta';
export type SegmentFilter = 'all' | 'equity' | 'fo' | 'mcx' | 'delta_perp' | 'delta_futures' | 'delta_options';

export function getTradeBroker(trade: Pick<TradeRecord, 'broker'>): 'zerodha' | 'delta' {
  return (trade.broker || 'zerodha').toLowerCase() === 'delta' ? 'delta' : 'zerodha';
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
