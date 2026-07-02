import assert from 'node:assert/strict';
import test from 'node:test';
import { findOpenTrades, matchTrades } from './trade-matcher.ts';
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

function deltaOrder(overrides: Partial<TradeOrder>): TradeOrder {
  return order({
    broker: 'delta',
    exchange: 'DELTA',
    segment: 'PERP',
    symbol: 'BTCUSDT',
    product_symbol: 'BTCUSDT',
    contract_type: 'PERPETUAL_FUTURES',
    notional_type: 'VANILLA',
    settlement_asset: 'USDT',
    fee_asset: 'USDT',
    contract_value: 0.001,
    price_multiplier: 0.001,
    qty: 2,
    price: 10_000,
    ...overrides,
  });
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

test('returns unmatched unrealised positions for live notes', () => {
  const result = findOpenTrades([order({ uid: 'open', order_id: 'open', exchange: 'NSE', symbol: 'ABC', price_multiplier: 1 })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].symbol, 'ABC');
  assert.equal(result[0].qty, 1);
  assert.equal(result[0].pnl, 0);
  assert.equal(result[0].exit_time, '');
});

test('matches NSE/BSE equity delivery exits across exchanges after one day', () => {
  const orders = [
    order({
      uid: 'buy',
      order_id: 'buy',
      symbol: 'ELGIEQUIP',
      exchange: 'BSE',
      segment: 'EQ',
      type: 'BUY',
      qty: 4,
      price: 579.9,
      trade_time: '2026-06-25 10:00:00',
      price_multiplier: 1,
    }),
    order({
      uid: 'sell',
      order_id: 'sell',
      symbol: 'ELGIEQUIP',
      exchange: 'NSE',
      segment: 'EQ',
      type: 'SELL',
      qty: 4,
      price: 607.4,
      trade_time: '2026-06-26 10:00:00',
      price_multiplier: 1,
    }),
  ];

  assert.equal(matchTrades(orders).length, 1);
  assert.equal(findOpenTrades(orders).length, 0);
});

test('keeps same-day NSE/BSE equity trades exchange-specific', () => {
  const orders = [
    order({
      uid: 'buy',
      order_id: 'buy',
      symbol: 'ELGIEQUIP',
      exchange: 'BSE',
      segment: 'EQ',
      type: 'BUY',
      qty: 4,
      price: 579.9,
      trade_time: '2026-06-25 10:00:00',
      price_multiplier: 1,
    }),
    order({
      uid: 'sell',
      order_id: 'sell',
      symbol: 'ELGIEQUIP',
      exchange: 'NSE',
      segment: 'EQ',
      type: 'SELL',
      qty: 4,
      price: 607.4,
      trade_time: '2026-06-25 10:05:00',
      price_multiplier: 1,
    }),
  ];

  assert.equal(matchTrades(orders).length, 0);
  assert.equal(findOpenTrades(orders).length, 2);
});

test('keeps broker-specific fills separate and preserves crypto metadata', () => {
  const deltaEntry = order({
    uid: 'delta-entry',
    broker: 'delta',
    order_id: 'shared-order',
    external_order_id: 'delta-order',
    external_trade_id: 'delta-fill-1',
    symbol: 'BTCUSD',
    exchange: 'DELTA',
    segment: 'CRYPTO',
    market_type: 'derivatives',
    product_id: 27,
    product_symbol: 'BTCUSD',
    contract_type: 'perpetual_futures',
    notional_type: 'VANILLA',
    settlement_asset: 'USDT',
    contract_value: 0.001,
    fee_amount: 0.12,
    fee_asset: 'USDT',
    price_multiplier: 1,
    qty: 2,
    price: 100,
  });
  const deltaExit = order({
    ...deltaEntry,
    uid: 'delta-exit',
    order_id: 'delta-exit-order',
    trade_time: '2026-06-25 10:10:00',
    type: 'SELL',
    price: 110,
    fee_amount: 0.10,
  });
  const zerodhaOpen = order({
    uid: 'zerodha-open',
    broker: 'zerodha',
    order_id: 'shared-order',
    symbol: 'BTCUSD',
    exchange: 'NSE',
    segment: 'EQ',
    price_multiplier: 1,
    qty: 2,
    price: 100,
  });

  const result = matchTrades([deltaEntry, deltaExit, zerodhaOpen]);

  assert.equal(result.length, 1);
  assert.equal(result[0].broker, 'delta');
  assert.equal(result[0].product_id, 27);
  assert.equal(result[0].settlement_asset, 'USDT');
  assert.equal(result[0].fee_amount, 0.22);
  assert.equal(result[0].pnl_currency, 'USDT');
});

test('calculates Delta linear long P&L with contract multiplier', () => {
  const result = matchTrades([
    deltaOrder({ uid: 'entry', order_id: 'entry', type: 'BUY', price: 10_000 }),
    deltaOrder({ uid: 'exit', order_id: 'exit', type: 'SELL', price: 11_000, trade_time: '2026-06-25 10:10:00' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].pnl, 2);
  assert.equal(result[0].price_multiplier, 0.001);
});

test('calculates Delta linear short P&L', () => {
  const result = matchTrades([
    deltaOrder({ uid: 'entry', order_id: 'entry', type: 'SELL', price: 11_000 }),
    deltaOrder({ uid: 'exit', order_id: 'exit', type: 'BUY', price: 10_000, trade_time: '2026-06-25 10:10:00' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'SHORT');
  assert.equal(result[0].pnl, 2);
});

test('uses Delta commission directly for net result and currency label', () => {
  const result = matchTrades([
    deltaOrder({ uid: 'entry', order_id: 'entry', type: 'BUY', price: 10_000, fee_amount: 0.4 }),
    deltaOrder({ uid: 'exit', order_id: 'exit', type: 'SELL', price: 10_100, fee_amount: 0.4, trade_time: '2026-06-25 10:10:00' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].pnl, 0.2);
  assert.equal(result[0].commission, 0.8);
  assert.equal(result[0].fee_amount, 0.8);
  assert.equal(result[0].result, 'loss');
  assert.equal(result[0].pnl_currency, 'USDT');
});

test('marks unsupported Delta notional types without guessing P&L', () => {
  const result = matchTrades([
    deltaOrder({ uid: 'entry', order_id: 'entry', type: 'BUY', price: 10_000, notional_type: 'INVERSE' }),
    deltaOrder({ uid: 'exit', order_id: 'exit', type: 'SELL', price: 11_000, notional_type: 'INVERSE', trade_time: '2026-06-25 10:10:00' }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].pnl, 0);
  assert.equal(result[0].calculation_status, 'unsupported');
  assert.match(result[0].calculation_warnings?.[0] || '', /Unsupported Delta notional_type/);
});
