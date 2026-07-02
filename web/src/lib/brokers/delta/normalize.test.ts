import assert from 'node:assert/strict';
import test from 'node:test';
import { deltaFillsToTradeOrders } from './normalize.ts';
import { buildDeltaProductIndex, normalizeDeltaProduct } from './products.ts';

test('normalizes Delta fills into trade orders', () => {
  const products = buildDeltaProductIndex([normalizeDeltaProduct({
    id: 27,
    symbol: 'BTCUSDT',
    contract_type: 'perpetual_futures',
    notional_type: 'vanilla',
    contract_value: '0.001',
    settlement_asset: { symbol: 'USDT' },
    quoting_asset: { symbol: 'USDT' },
  })]);

  const orders = deltaFillsToTradeOrders([{
    id: 'fill-1',
    side: 'buy',
    size: '2',
    price: '100',
    role: 'maker',
    commission: '0.12',
    created_at: '2026-07-02T10:00:00.000Z',
    product_id: 27,
    product_symbol: 'BTCUSDT',
    order_id: 'order-1',
  }], products);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'delta:BTCUSDT:fill-1');
  assert.equal(orders[0].broker, 'delta');
  assert.equal(orders[0].exchange, 'DELTA');
  assert.equal(orders[0].segment, 'PERP');
  assert.equal(orders[0].type, 'BUY');
  assert.equal(orders[0].qty, 2);
  assert.equal(orders[0].price_multiplier, 0.001);
  assert.equal(orders[0].notional_type, 'VANILLA');
  assert.equal(orders[0].fee_amount, 0.12);
  assert.equal(orders[0].settlement_asset, 'USDT');
  assert.equal(orders[0].external_trade_id, 'fill-1');
  assert.equal(orders[0].external_order_id, 'order-1');
  assert.equal(orders[0].liquidity_role, 'maker');
});
