import type { TradeOrder } from '@/lib/types/trading';
import type { DhanTrade } from './client';

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function exchange(value: string) {
  return value.split('_')[0] || value;
}

function instrumentType(trade: DhanTrade): TradeOrder['instrument_type'] {
  const optionType = text(trade.drvOptionType).toUpperCase();
  if (optionType === 'CALL') return 'CE';
  if (optionType === 'PUT') return 'PE';
  return text(trade.exchangeSegment).endsWith('_EQ') ? 'EQ' : 'FUT';
}

export function dhanTradesToTradeOrders(trades: DhanTrade[]): TradeOrder[] {
  return trades.flatMap((trade) => {
    const tradeId = text(trade.exchangeTradeId);
    const orderId = text(trade.orderId);
    const symbol = text(trade.tradingSymbol || trade.securityId).toUpperCase();
    const side = text(trade.transactionType).toUpperCase();
    const qty = numberValue(trade.tradedQuantity);
    const price = numberValue(trade.tradedPrice);
    if (!tradeId || !orderId || !symbol || qty <= 0 || price <= 0 || (side !== 'BUY' && side !== 'SELL')) return [];

    const segment = text(trade.exchangeSegment).toUpperCase();
    return [{
      uid: `dhan:${trade.dhanClientId || ''}:${orderId}:${tradeId}`,
      broker: 'dhan',
      market_type: 'india',
      symbol,
      exchange: exchange(segment),
      segment,
      product_symbol: symbol,
      expiry_date: text(trade.drvExpiryDate),
      instrument_name: symbol,
      instrument_type: instrumentType(trade),
      strike: numberValue(trade.drvStrikePrice),
      lot_size: 1,
      price_multiplier: 1,
      trade_time: text(trade.exchangeTime || trade.updateTime || trade.createTime).replace('T', ' ').split('.')[0],
      order_id: orderId,
      trade_id: tradeId,
      external_order_id: text(trade.exchangeOrderId || orderId),
      external_trade_id: tradeId,
      type: side as TradeOrder['type'],
      qty,
      price,
    }];
  });
}
