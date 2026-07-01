import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTradeCommission } from './commission.ts';
import type { TradeOrder } from '../types/trading.ts';

function leg(type: 'BUY' | 'SELL'): TradeOrder {
  return {
    uid: type,
    symbol: 'MENTHAOIL26JULFUT',
    exchange: 'MCX',
    segment: 'MCX-FUT',
    instrument_name: 'MENTHAOIL',
    instrument_type: 'FUT',
    price_multiplier: 360,
    commodity_class: 'agricultural',
    trade_time: '2026-06-25 10:00:00',
    type,
    qty: 1,
    price: 1_000,
  };
}

function equityLeg(type: 'BUY' | 'SELL'): TradeOrder {
  return {
    uid: type,
    symbol: 'DEEPAKFERT',
    exchange: 'NSE',
    segment: 'EQ',
    trade_time: type === 'BUY' ? '2026-06-11 10:35:00' : '2026-06-16 10:51:00',
    type,
    qty: 3,
    price: type === 'BUY' ? 1536 : 1538.8,
  };
}

test('uses multiplied turnover and agricultural MCX tax treatment', () => {
  const commission = calculateTradeCommission({
    symbol: 'MENTHAOIL26JULFUT',
    exchange: 'MCX',
    segment: 'MCX-FUT',
    direction: 'LONG',
    qty: 1,
    avg_entry: 1_000,
    avg_exit: 1_000,
    entry_time: '2026-06-25 10:00:00',
    exit_time: '2026-06-25 11:00:00',
    orders: [leg('BUY'), leg('SELL')],
  });

  assert.equal(commission.stt, 0);
  assert.ok(commission.exchangeCharge > 10);
  assert.ok(commission.sebiFee > 0);
});

test('excludes DP ledger charge from equity delivery commission', () => {
  const commission = calculateTradeCommission({
    symbol: 'DEEPAKFERT',
    exchange: 'NSE',
    segment: 'EQ',
    direction: 'LONG',
    qty: 3,
    avg_entry: 1536,
    avg_exit: 1538.8,
    entry_time: '2026-06-11 10:35:00',
    exit_time: '2026-06-16 10:51:00',
    orders: [equityLeg('BUY'), equityLeg('SELL')],
  });

  assert.equal(commission.dpCharge, 0);
  assert.equal(commission.total, 10.26);
});
