import type { TradeOrder } from '@/lib/types/trading';

export const TRADE_MONTH_RETENTION_LIMIT = 6;

export function tradeMonth(order: Pick<TradeOrder, 'trade_date' | 'trade_time'>): string {
  const value = order.trade_date || order.trade_time || '';
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

export function latestTradeMonths(orders: Pick<TradeOrder, 'trade_date' | 'trade_time'>[], limit = TRADE_MONTH_RETENTION_LIMIT) {
  return new Set(
    [...new Set(orders.map(tradeMonth).filter(Boolean))]
      .sort()
      .slice(-limit),
  );
}
