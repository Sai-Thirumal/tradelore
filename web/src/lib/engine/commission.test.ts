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
