import type { TradeOrder } from '@/lib/types/trading';
import type { KiteTradeFill } from './client';
import type { BrokerInstrumentIndex } from './instruments';
import { enrichMcxMetadata } from '../../../engine/mcx.ts';

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

export function kiteFillsToTradeOrders(
  fills: KiteTradeFill[],
  kiteUserId: string,
  instrumentIndexes: Partial<Record<'NFO' | 'BFO' | 'MCX', BrokerInstrumentIndex>> = {},
): TradeOrder[] {
  return fills
    .filter((fill) => fill.trade_id && fill.order_id && fill.tradingsymbol && fill.quantity > 0 && fill.average_price > 0)
    .map((fill) => {
      const exchange = fill.exchange.trim().toUpperCase();
      const symbol = fill.tradingsymbol.trim().toUpperCase();
      const instrumentIndex = exchange === 'NFO' || exchange === 'BFO' || exchange === 'MCX'
        ? instrumentIndexes[exchange]
        : undefined;
      const instrument = (fill.instrument_token
        ? instrumentIndex?.byToken.get(fill.instrument_token)
        : undefined) || instrumentIndex?.bySymbol.get(symbol);
      const mcxMetadata = exchange === 'MCX'
        ? enrichMcxMetadata(symbol, {
            instrument_name: instrument?.name,
            instrument_type: instrument?.instrumentType,
            price_multiplier: instrument?.priceMultiplier,
            commodity_class: instrument?.commodityClass,
            metadata_source: instrument?.metadataSource,
          })
        : null;

      return {
        uid: `zerodha:${kiteUserId}:${fill.order_id}:${fill.trade_id}`,
        broker: 'zerodha',
        symbol,
        exchange,
        segment: instrument?.segment || getSegment(fill.exchange || '', fill.product),
        expiry_date: instrument?.expiryDate || '',
        instrument_token: fill.instrument_token,
        instrument_name: instrument?.name || mcxMetadata?.instrumentName || '',
        instrument_type: instrument?.instrumentType || mcxMetadata?.instrumentType || '',
        strike: instrument?.strike || 0,
        lot_size: instrument?.lotSize || 1,
        price_multiplier: instrument?.priceMultiplier || mcxMetadata?.priceMultiplier || 1,
        commodity_class: instrument?.commodityClass || mcxMetadata?.commodityClass || '',
        metadata_source: instrument?.metadataSource || mcxMetadata?.specificationSource || '',
        trade_time: normaliseDatetime(fill.fill_timestamp),
        order_id: fill.order_id,
        trade_id: fill.trade_id,
        type: fill.transaction_type,
        qty: Number(fill.quantity),
        price: Number(fill.average_price),
      };
    });
}
