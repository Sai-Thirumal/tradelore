import type { TradeOrder } from '@/lib/types/trading';
import type { KiteTradeFill } from './client';

function normaliseDatetime(raw: string) {
  return raw.replace('T', ' ').split('.')[0];
}

function getSegment(exchange: string, product?: string) {
  const ex = exchange.toUpperCase();
  if (ex === 'NSE' || ex === 'BSE') return product === 'CNC' ? 'EQ' : 'EQ';
  if (ex === 'NFO' || ex === 'BFO') return ex;
  if (ex === 'MCX') return 'MCX';
  return ex;
}

export function kiteFillsToTradeOrders(fills: KiteTradeFill[], kiteUserId: string): TradeOrder[] {
  return fills
    .filter((fill) => fill.trade_id && fill.order_id && fill.tradingsymbol && fill.quantity > 0 && fill.average_price > 0)
    .map((fill) => ({
      uid: `zerodha:${kiteUserId}:${fill.order_id}:${fill.trade_id}`,
      symbol: fill.tradingsymbol.trim(),
      exchange: fill.exchange.trim().toUpperCase(),
      segment: getSegment(fill.exchange || '', fill.product),
      expiry_date: '',
      trade_time: normaliseDatetime(fill.fill_timestamp),
      order_id: fill.order_id,
      trade_id: fill.trade_id,
      type: fill.transaction_type,
      qty: Number(fill.quantity),
      price: Number(fill.average_price),
    }));
}
