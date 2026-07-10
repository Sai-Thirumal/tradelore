import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angelOneTradesToTradeOrders } from './normalize.ts';

test('normalises Angel One trade book rows', () => {
  const orders = angelOneTradesToTradeOrders([{
    orderid: 'order-1',
    fillid: 'trade-1',
    exchange: 'NSE',
    tradingsymbol: 'SBIN-EQ',
    symboltoken: '3045',
    transactiontype: 'BUY',
    fillsize: '2',
    fillprice: '625.5',
    filltime: '2026-07-10 09:31:05',
    producttype: 'DELIVERY',
  }], 'A123');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'angelone:A123:order-1:trade-1');
  assert.equal(orders[0].broker, 'angelone');
  assert.equal(orders[0].symbol, 'SBIN-EQ');
  assert.equal(orders[0].segment, 'EQ');
  assert.equal(orders[0].qty, 2);
  assert.equal(orders[0].price, 625.5);
});
