import Papa from 'papaparse';
import type { TradeOrder } from '@/lib/types/trading';
import { enrichMcxMetadata } from './mcx';

const HEADER_MAP: Record<string, string> = {
  "symbol": "symbol", "scrip": "symbol", "stock": "symbol",
  "trade time": "trade_time", "trade_time": "trade_time",
  "order execution time": "trade_time", "order_execution_time": "trade_time",
  "date": "trade_time", "time": "trade_time", "trade_date": "trade_date",
  "order id": "order_id", "order_id": "order_id", "orderid": "order_id",
  "trade id": "trade_id", "trade_id": "trade_id", "tradeid": "trade_id",
  "type": "type", "trade type": "type", "trade_type": "type",
  "buy / sell": "type", "buy/sell": "type", "side": "type",
  "qty": "qty", "quantity": "qty", "qty.": "qty", "shares": "qty",
  "price": "price", "trade price": "price", "execution price": "price",
  "exchange": "exchange", "market": "exchange",
  "segment": "segment",
  "expiry_date": "expiry_date", "expiry": "expiry_date",
  "instrument_token": "instrument_token", "instrument token": "instrument_token",
  "instrument_name": "instrument_name", "instrument name": "instrument_name",
  "instrument_type": "instrument_type", "instrument type": "instrument_type",
  "strike": "strike",
  "lot_size": "lot_size", "lot size": "lot_size",
  "price_multiplier": "price_multiplier", "price multiplier": "price_multiplier",
  "contract_multiplier": "price_multiplier", "contract multiplier": "price_multiplier",
  "commodity_class": "commodity_class", "commodity class": "commodity_class",
};

const EXCHANGE_CODES = new Set(["NSE", "BSE", "NFO", "MCX", "BFO", "CDS", "NCD"]);

function normaliseDatetime(raw: string) {
  return raw.replace("T", " ").split(".")[0];
}

export async function parseCsv(fileContent: string, broker = 'zerodha'): Promise<TradeOrder[]> {
  const result = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
  const rows = result.data as Record<string, string>[];
  
  const orders: TradeOrder[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    // map columns
    const row: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawRow)) {
      const lowerKey = key.trim().toLowerCase();
      const mapped = HEADER_MAP[lowerKey] || lowerKey;
      if (!row[mapped]) row[mapped] = val;
    }

    let symbol = (row.symbol || '').trim();
    if (!symbol) continue;

    let exchange = (row.exchange || '').trim();
    const parts = symbol.split(' ');
    if (parts.length >= 2 && EXCHANGE_CODES.has(parts[parts.length - 1].toUpperCase())) {
      exchange = exchange || parts[parts.length - 1].toUpperCase();
      symbol = parts.slice(0, -1).join(' ');
    }

    let orderType = (row.type || '').toUpperCase().replace(/ /g, '');
    if (orderType === 'B') orderType = 'BUY';
    if (orderType === 'S') orderType = 'SELL';
    if (orderType !== 'BUY' && orderType !== 'SELL') continue;

    const qty = parseFloat((row.qty || '0').replace(/,/g, ''));
    const price = parseFloat((row.price || '0').replace(/,/g, ''));

    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) continue;

    const tradeTimeRaw = (row.trade_time || '').trim();
    const tradeDateRaw = (row.trade_date || '').trim();

    let tradeTime = '';
    if (tradeTimeRaw) {
      tradeTime = normaliseDatetime(tradeTimeRaw);
    } else if (tradeDateRaw) {
      tradeTime = tradeDateRaw + " 00:00:00";
    }

    const orderId = (row.order_id || '').trim();
    const tradeId = (row.trade_id || '').trim();
    let segment = (row.segment || '').trim().toUpperCase();
    const expiryDate = (row.expiry_date || '').trim();
    const isMcx = exchange.toUpperCase() === 'MCX' || segment.startsWith('MCX');
    if (isMcx && !segment) segment = 'MCX';
    const mcxMetadata = isMcx
      ? enrichMcxMetadata(symbol, {
          instrument_name: (row.instrument_name || '').trim().toUpperCase(),
          instrument_type: (row.instrument_type || '').trim().toUpperCase() as TradeOrder['instrument_type'],
          price_multiplier: parseFloat(row.price_multiplier || '0'),
          commodity_class: (row.commodity_class || '').trim().toLowerCase() as TradeOrder['commodity_class'],
          metadata_source: row.price_multiplier ? 'csv' : '',
        })
      : null;

    const uid = (orderId && tradeId) 
      ? `${orderId}_${tradeId}`
      : `${symbol}_${tradeTime}_${orderType}_${qty}_${price}_${i}`;

    orders.push({
      uid, broker, symbol, exchange: exchange.toUpperCase(), segment, expiry_date: expiryDate,
      instrument_token: parseInt(row.instrument_token || '0') || undefined,
      instrument_name: mcxMetadata?.instrumentName || (row.instrument_name || '').trim(),
      instrument_type: mcxMetadata?.instrumentType || '',
      strike: parseFloat(row.strike || '0') || 0,
      lot_size: parseFloat(row.lot_size || '0') || 1,
      price_multiplier: mcxMetadata?.priceMultiplier || 1,
      commodity_class: mcxMetadata?.commodityClass || '',
      metadata_source: mcxMetadata?.specificationSource || '',
      trade_time: tradeTime, order_id: orderId, trade_id: tradeId,
      type: orderType, qty, price
    });
  }

  return orders;
}
