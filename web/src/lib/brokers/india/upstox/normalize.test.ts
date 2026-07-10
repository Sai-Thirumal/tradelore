import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upstoxTradesToTradeOrders } from './normalize.ts';

test('normalizes Upstox historical trades into trade orders', () => {
  const orders = upstoxTradesToTradeOrders([{
    exchange: 'NFO',
    segment: 'FO',
    option_type: 'CE',
    quantity: 25,
    trade_id: '430927903',
    trade_date: '2026-07-08',
    transaction_type: 'SELL',
    scrip_name: 'BANKNIFTY',
    strike_price: '40000.0',
    expiry: '2026-07-30',
    price: 609.5,
    symbol: 'BANKNIFTY',
  }], 'U123');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'upstox:U123:2026-07-08:430927903');
  assert.equal(orders[0].broker, 'upstox');
  assert.equal(orders[0].exchange, 'NFO');
  assert.equal(orders[0].instrument_type, 'CE');
  assert.equal(orders[0].type, 'SELL');
  assert.equal(orders[0].qty, 25);
});
