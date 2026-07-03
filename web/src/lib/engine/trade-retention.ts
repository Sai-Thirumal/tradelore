import type { TradeOrder } from '@/lib/types/trading';

export const TRADE_MONTH_RETENTION_LIMIT = 6;
type RetentionOrder = Pick<TradeOrder, 'broker' | 'trade_date' | 'trade_time'>;

export function tradeMonth(order: Pick<TradeOrder, 'trade_date' | 'trade_time'>): string {
  const value = order.trade_date || order.trade_time || '';
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

export function tradeRetentionKey(order: RetentionOrder): string {
  const month = tradeMonth(order);
  if (!month) return '';
  return `${(order.broker || 'zerodha').trim().toLowerCase()}|||${month}`;
}

export function latestTradeMonths(orders: Pick<TradeOrder, 'trade_date' | 'trade_time'>[], limit = TRADE_MONTH_RETENTION_LIMIT) {
  return new Set(
    [...new Set(orders.map(tradeMonth).filter(Boolean))]
      .sort()
      .slice(-limit),
  );
}

export function latestTradeRetentionKeysByBroker(orders: RetentionOrder[], limit = TRADE_MONTH_RETENTION_LIMIT) {
  const monthsByBroker = new Map<string, Set<string>>();

  for (const order of orders) {
    const month = tradeMonth(order);
    if (!month) continue;
    const broker = (order.broker || 'zerodha').trim().toLowerCase();
    if (!monthsByBroker.has(broker)) monthsByBroker.set(broker, new Set());
    monthsByBroker.get(broker)?.add(month);
  }

  return new Set(
    [...monthsByBroker.entries()].flatMap(([broker, months]) =>
      [...months]
        .sort()
        .slice(-limit)
        .map(month => `${broker}|||${month}`),
    ),
  );
}
