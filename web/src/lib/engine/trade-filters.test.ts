import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterTradesForScope,
  getDeltaInstrumentFamilyLabel,
  getScopeCurrency,
  getTradeInstrumentLabel,
  getTradeSegmentBucket,
} from './trade-filters.ts';
import type { TradeRecord } from '../types/trading.ts';

function trade(overrides: Partial<TradeRecord>): TradeRecord {
  return {
    symbol: 'NIFTY',
    exchange: 'NSE',
    segment: 'EQ',
    direction: 'LONG',
    qty: 1,
    avg_entry: 100,
    avg_exit: 110,
    entry_time: '2026-01-01 10:00:00',
    exit_time: '2026-01-01 10:05:00',
    trade_date: '2026-01-01',
    pnl: 10,
    result: 'win',
    ...overrides,
  };
}

test('buckets Delta derivative segments and labels exact symbols plus report families', () => {
  const perp = trade({ broker: 'delta', exchange: 'DELTA', segment: 'PERP', product_symbol: 'BTCUSDT' });
  const option = trade({ broker: 'delta', exchange: 'DELTA', segment: 'CALL_OPTION', product_symbol: 'C-BTC-50000-010126' });
  const future = trade({ broker: 'delta', exchange: 'DELTA', segment: 'FUTURES', product_symbol: 'ETHUSD' });

  assert.equal(getTradeSegmentBucket(perp), 'delta_perp');
  assert.equal(getTradeSegmentBucket(option), 'delta_options');
  assert.equal(getTradeInstrumentLabel(perp), 'BTCUSDT');
  assert.equal(getTradeInstrumentLabel(option), 'C-BTC-50000-010126');
  assert.equal(getDeltaInstrumentFamilyLabel(perp), 'BTC Perpetuals');
  assert.equal(getDeltaInstrumentFamilyLabel(option), 'BTC Options');
  assert.equal(getDeltaInstrumentFamilyLabel(future), 'ETH Futures');
});

test('filters by broker and segment without changing legacy Zerodha defaults', () => {
  const trades = [
    trade({ symbol: 'RELIANCE', segment: 'EQ' }),
    trade({ symbol: 'CRUDEOIL', exchange: 'MCX', segment: 'MCX-FUT' }),
    trade({ broker: 'delta', exchange: 'DELTA', segment: 'PERP', product_symbol: 'ETHUSDT' }),
  ];

  assert.deepEqual(filterTradesForScope(trades, 'zerodha', 'equity').map((t) => t.symbol), ['RELIANCE']);
  assert.deepEqual(filterTradesForScope(trades, 'all', 'mcx').map((t) => t.symbol), ['CRUDEOIL']);
  assert.deepEqual(filterTradesForScope(trades, 'delta', 'delta_perp').map((t) => t.product_symbol), ['ETHUSDT']);
});

test('uses native settlement currency for Delta report scopes', () => {
  assert.equal(getScopeCurrency([trade({ broker: 'delta', settlement_asset: 'USDT' })]), 'USDT');
  assert.equal(getScopeCurrency([trade({ broker: 'delta', settlement_asset: 'USDT' }), trade({ broker: 'delta', settlement_asset: 'USD' })]), 'MIXED');
  assert.equal(getScopeCurrency([trade({ broker: 'zerodha' })]), 'INR');
});
