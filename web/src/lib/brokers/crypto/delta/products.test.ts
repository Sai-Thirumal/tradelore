import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDeltaProduct } from './products.ts';

test('normalizes Delta product metadata for cache and matcher use', () => {
  const product = normalizeDeltaProduct({
    id: '27',
    symbol: 'BTCUSDT',
    contract_type: 'perpetual_futures',
    notional_type: 'vanilla',
    contract_value: '0.001',
    contract_unit_currency: 'BTC',
    quoting_asset: { symbol: 'USDT' },
    settling_asset: { symbol: 'USDT' },
    expiry_time: '2026-12-31T12:00:00Z',
    settlement_time: '2026-12-31T12:05:00Z',
    settlement_method: 'cash',
  });

  assert.equal(product.symbol, 'BTCUSDT');
  assert.equal(product.product_id, 27);
  assert.equal(product.contract_type, 'PERPETUAL_FUTURES');
  assert.equal(product.notional_type, 'VANILLA');
  assert.equal(product.contract_value, 0.001);
  assert.equal(product.contract_unit_currency, 'BTC');
  assert.equal(product.quoting_asset, 'USDT');
  assert.equal(product.settling_asset, 'USDT');
  assert.equal(product.expiry_time, '2026-12-31T12:00:00Z');
  assert.equal(product.settlement_method, 'cash');
});
