import type { TradeOrder } from '@/lib/types/trading';
import type { UpstoxHistoricalTrade } from './client';

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function instrumentType(trade: UpstoxHistoricalTrade): TradeOrder['instrument_type'] {
  const optionType = text(trade.option_type).toUpperCase();
  if (optionType === 'CE' || optionType === 'PE') return optionType;
  return text(trade.segment).toUpperCase() === 'EQ' ? 'EQ' : 'FUT';
}

export function upstoxTradesToTradeOrders(trades: UpstoxHistoricalTrade[], userId = ''): TradeOrder[] {
  return trades.flatMap((trade) => {
    const tradeId = text(trade.trade_id);
    const symbol = text(trade.symbol || trade.scrip_name || trade.instrument_token).toUpperCase();
    const side = text(trade.transaction_type).toUpperCase();
    const qty = numberValue(trade.quantity);
    const price = numberValue(trade.price);
    const tradeDate = text(trade.trade_date);
    if (!tradeId || !symbol || !tradeDate || qty <= 0 || price <= 0 || (side !== 'BUY' && side !== 'SELL')) return [];

    const exchange = text(trade.exchange).toUpperCase();
    const segment = text(trade.segment).toUpperCase();

    return [{
      uid: `upstox:${userId}:${tradeDate}:${tradeId}`,
      broker: 'upstox',
      market_type: 'india',
      symbol,
      exchange,
      segment,
      product_symbol: symbol,
      expiry_date: text(trade.expiry),
      instrument_name: text(trade.scrip_name || symbol),
      instrument_type: instrumentType(trade),
      strike: numberValue(trade.strike_price),
      lot_size: 1,
      price_multiplier: 1,
      // ponytail: historical Upstox trades expose date only; add current-day trade enrichment if intraday markers matter.
      trade_time: `${tradeDate} 00:00:00`,
      trade_date: tradeDate,
      order_id: `upstox:${tradeDate}:${tradeId}`,
      trade_id: tradeId,
      external_trade_id: tradeId,
      type: side as TradeOrder['type'],
      qty,
      price,
    }];
  });
}
