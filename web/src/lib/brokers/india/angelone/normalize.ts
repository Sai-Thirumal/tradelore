import type { TradeOrder } from '@/lib/types/trading';
import type { AngelOneTrade } from './client';

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normaliseTime(value: unknown) {
  return text(value).replace('T', ' ').split('.')[0];
}

function instrumentType(trade: AngelOneTrade): TradeOrder['instrument_type'] {
  const optionType = text(trade.optiontype).toUpperCase();
  if (optionType === 'CE' || optionType === 'PE') return optionType;
  const type = text(trade.instrumenttype).toUpperCase();
  if (type.includes('OPT')) return optionType === 'PE' ? 'PE' : 'CE';
  if (type.includes('FUT')) return 'FUT';
  return 'EQ';
}

export function angelOneTradesToTradeOrders(trades: AngelOneTrade[], userId = ''): TradeOrder[] {
  return trades.flatMap((trade) => {
    const orderId = text(trade.orderid || trade.order_id || trade.uniqueorderid);
    const tradeId = text(trade.fillid || trade.tradeid);
    const symbol = text(trade.tradingsymbol || trade.symbolname || trade.symboltoken).toUpperCase();
    const side = text(trade.transactiontype).toUpperCase();
    const qty = numberValue(trade.fillsize || trade.quantity);
    const price = numberValue(trade.fillprice || trade.price);
    const tradeTime = normaliseTime(trade.filltime || trade.exchorderupdatetime || trade.updatetime);

    if (!orderId || !tradeId || !symbol || !tradeTime || qty <= 0 || price <= 0 || (side !== 'BUY' && side !== 'SELL')) return [];

    const exchange = text(trade.exchange).toUpperCase();
    const productType = text(trade.producttype).toUpperCase();
    const segment = exchange === 'NSE' || exchange === 'BSE' ? 'EQ' : exchange;

    return [{
      uid: `angelone:${userId}:${orderId}:${tradeId}`,
      broker: 'angelone',
      market_type: 'india',
      symbol,
      exchange,
      segment,
      product_symbol: symbol,
      expiry_date: text(trade.expirydate),
      instrument_token: numberValue(trade.symboltoken) || undefined,
      instrument_name: text(trade.symbolname || symbol),
      instrument_type: instrumentType(trade),
      strike: numberValue(trade.strikeprice),
      lot_size: 1,
      price_multiplier: 1,
      metadata_source: productType,
      trade_time: tradeTime,
      trade_date: tradeTime.slice(0, 10),
      order_id: orderId,
      trade_id: tradeId,
      external_order_id: orderId,
      external_trade_id: tradeId,
      type: side as TradeOrder['type'],
      qty,
      price,
    }];
  });
}
