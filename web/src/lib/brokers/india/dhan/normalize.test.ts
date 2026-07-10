import assert from 'node:assert/strict';
import test from 'node:test';
import { dhanTradesToTradeOrders } from './normalize.ts';

test('normalizes Dhan trades into trade orders', () => {
  const orders = dhanTradesToTradeOrders([{
    dhanClientId: '1100003626',
    orderId: 'order-1',
    exchangeOrderId: 'exchange-order-1',
    exchangeTradeId: 'trade-1',
    transactionType: 'BUY',
    exchangeSegment: 'NSE_FNO',
    tradingSymbol: 'NIFTY26JUL25000CE',
    securityId: '12345',
    tradedQuantity: '75',
    tradedPrice: '120.5',
    exchangeTime: '2026-07-09 09:16:00',
    drvExpiryDate: '2026-07-30',
    drvOptionType: 'CALL',
    drvStrikePrice: 25000,
  }]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'dhan:1100003626:order-1:trade-1');
  assert.equal(orders[0].broker, 'dhan');
  assert.equal(orders[0].exchange, 'NSE');
  assert.equal(orders[0].segment, 'NSE_FNO');
  assert.equal(orders[0].instrument_type, 'CE');
  assert.equal(orders[0].type, 'BUY');
  assert.equal(orders[0].qty, 75);
  assert.equal(orders[0].price, 120.5);
  assert.equal(orders[0].external_order_id, 'exchange-order-1');
});
