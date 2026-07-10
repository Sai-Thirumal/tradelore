import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInstrumentCsv, parseMcxInstrumentCsv } from './instruments.ts';
import { kiteFillsToTradeOrders } from './normalize.ts';

test('parses and enriches Kite MCX instrument rows', () => {
  const csv = [
    'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange',
    '119445255,466583,GOLD26AUGFUT,GOLD,0,2026-08-05,0,1,1,FUT,MCX-FUT,MCX',
  ].join('\n');
  const index = parseMcxInstrumentCsv(csv);
  const instrument = index.byToken.get(119445255);

  assert.equal(instrument?.expiryDate, '2026-08-05');
  assert.equal(instrument?.priceMultiplier, 100);
  assert.equal(instrument?.commodityClass, 'non_agricultural');
});

test('parses exact NFO option metadata', () => {
  const csv = [
    'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange',
    '123456,654321,NIFTY26JUN25000CE,NIFTY,0,2026-06-25,25000,0.05,75,CE,NFO-OPT,NFO',
  ].join('\n');
  const instrument = parseInstrumentCsv(csv, 'NFO').byToken.get(123456);

  assert.equal(instrument?.name, 'NIFTY');
  assert.equal(instrument?.expiryDate, '2026-06-25');
  assert.equal(instrument?.strike, 25000);
  assert.equal(instrument?.lotSize, 75);
  assert.equal(instrument?.instrumentType, 'CE');
  assert.equal(instrument?.segment, 'NFO-OPT');
  assert.equal(instrument?.metadataSource, 'kite-nfo-instruments');
});

test('parses exact BFO futures metadata and rejects other exchanges', () => {
  const csv = [
    'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange',
    '223456,754321,SENSEX26JUNFUT,SENSEX,0,2026-06-25,0,0.05,20,FUT,BFO-FUT,BFO',
    '323456,854321,NIFTY26JUNFUT,NIFTY,0,2026-06-25,0,0.05,75,FUT,NFO-FUT,NFO',
  ].join('\n');
  const index = parseInstrumentCsv(csv, 'BFO');
  const instrument = index.bySymbol.get('SENSEX26JUNFUT');

  assert.equal(index.byToken.size, 1);
  assert.equal(instrument?.expiryDate, '2026-06-25');
  assert.equal(instrument?.lotSize, 20);
  assert.equal(instrument?.instrumentType, 'FUT');
  assert.equal(instrument?.exchange, 'BFO');
});

test('applies NFO/BFO instrument metadata to normalized Kite fills', () => {
  const header = 'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange';
  const nfo = parseInstrumentCsv([
    header,
    '123456,654321,NIFTY26JUN25000CE,NIFTY,0,2026-06-25,25000,0.05,75,CE,NFO-OPT,NFO',
  ].join('\n'), 'NFO');
  const bfo = parseInstrumentCsv([
    header,
    '223456,754321,SENSEX26JUNFUT,SENSEX,0,2026-06-25,0,0.05,20,FUT,BFO-FUT,BFO',
  ].join('\n'), 'BFO');

  const orders = kiteFillsToTradeOrders([
    {
      trade_id: '1',
      order_id: '11',
      exchange: 'NFO',
      tradingsymbol: 'NIFTY26JUN25000CE',
      instrument_token: 123456,
      average_price: 100,
      quantity: 75,
      transaction_type: 'BUY',
      fill_timestamp: '2026-06-20 10:00:00',
    },
    {
      trade_id: '2',
      order_id: '22',
      exchange: 'BFO',
      tradingsymbol: 'SENSEX26JUNFUT',
      instrument_token: 223456,
      average_price: 80000,
      quantity: 20,
      transaction_type: 'SELL',
      fill_timestamp: '2026-06-20 10:01:00',
    },
  ], 'AB1234', { NFO: nfo, BFO: bfo });

  assert.deepEqual(
    orders.map(({ expiry_date, strike, lot_size, instrument_type, segment }) => ({
      expiry_date, strike, lot_size, instrument_type, segment,
    })),
    [
      { expiry_date: '2026-06-25', strike: 25000, lot_size: 75, instrument_type: 'CE', segment: 'NFO-OPT' },
      { expiry_date: '2026-06-25', strike: 0, lot_size: 20, instrument_type: 'FUT', segment: 'BFO-FUT' },
    ],
  );
});
