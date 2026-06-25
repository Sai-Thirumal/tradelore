import assert from 'node:assert/strict';
import test from 'node:test';
import { matchTrades } from './trade-matcher.ts';
import type { TradeOrder } from '../types/trading.ts';

function order(overrides: Partial<TradeOrder>): TradeOrder {
  return {
    uid: crypto.randomUUID(),
    symbol: 'GOLD26AUGFUT',
    exchange: 'MCX',
    segment: 'MCX-FUT',
    instrument_name: 'GOLD',
    instrument_type: 'FUT',
    price_multiplier: 100,
    commodity_class: 'non_agricultural',
    trade_time: '2026-06-25 10:00:00',
    type: 'BUY',
    qty: 1,
    price: 100_000,
    ...overrides,
  };
}

test('applies MCX price multiplier to realised P&L', () => {
  const result = matchTrades([
    order({ uid: 'entry', order_id: 'entry', type: 'BUY', price: 100_000 }),
    order({ uid: 'exit', order_id: 'exit', type: 'SELL', price: 100_010, trade_time: '2026-06-25 10:10:00' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].pnl, 1_000);
  assert.equal(result[0].price_multiplier, 100);
});

test('splits reversal fills while continuing to emit completed trades only', () => {
  const result = matchTrades([
    order({ uid: 'entry', order_id: 'entry', exchange: 'NSE', segment: 'EQ', symbol: 'ABC', price_multiplier: 1 }),
    order({
      uid: 'reverse',
      order_id: 'reverse',
      exchange: 'NSE',
      segment: 'EQ',
      symbol: 'ABC',
      type: 'SELL',
      qty: 2,
      price: 110,
      trade_time: '2026-06-25 10:10:00',
      price_multiplier: 1,
    }),
  ]);

  assert.equal(result.length, 1);
});

test('does not emit unmatched unrealised positions', () => {
  const result = matchTrades([order({ uid: 'open', order_id: 'open' })]);
  assert.equal(result.length, 0);
});
