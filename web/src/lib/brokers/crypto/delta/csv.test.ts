import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeltaCsvHeaders, parseDeltaCsv } from './csv.ts';
import { normalizeDeltaProduct } from './products.ts';

const csv = `fill id,side,size,price,role,commission,created_at,product id,product symbol,order id,settlement asset
f1,buy,2,100,maker,0.12,2026-07-02T10:00:00Z,27,BTCUSDT,o1,USDT
f1,buy,2,100,maker,0.12,2026-07-02T10:00:00Z,27,BTCUSDT,o1,USDT`;

test('detects Delta CSV headers', () => {
  assert.equal(isDeltaCsvHeaders(['fill id', 'side', 'size', 'price', 'created_at', 'product symbol']), true);
  assert.equal(isDeltaCsvHeaders(['symbol', 'trade_date', 'trade_type', 'quantity', 'price']), false);
});

test('normalizes Delta CSV rows to trade orders', () => {
  const orders = parseDeltaCsv(csv, [normalizeDeltaProduct({
    id: 27,
    symbol: 'BTCUSDT',
    contract_type: 'perpetual_futures',
    notional_type: 'vanilla',
    contract_value: '0.001',
    settling_asset_symbol: 'USDT',
  })]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'delta:BTCUSDT:f1');
  assert.equal(orders[0].broker, 'delta');
  assert.equal(orders[0].type, 'BUY');
  assert.equal(orders[0].qty, 2);
  assert.equal(orders[0].fee_amount, 0.12);
});

test('attaches Delta product metadata by product symbol', () => {
  const orders = parseDeltaCsv(csv.replace('27', ''), [normalizeDeltaProduct({
    symbol: 'BTCUSDT',
    contract_type: 'perpetual_futures',
    notional_type: 'vanilla',
    contract_value: '0.002',
    settling_asset_symbol: 'USDT',
  })]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].contract_value, 0.002);
  assert.equal(orders[0].price_multiplier, 0.002);
  assert.equal(orders[0].settlement_asset, 'USDT');
});

test('uses Delta CSV product metadata fallback and drops duplicate fills', () => {
  const withMetadata = `fill id,side,size,price,commission,created_at,product symbol,order id,settling asset symbol,contract value,contract type,notional type
f2,sell,1,110,0.05,2026-07-02T10:05:00Z,ETHUSDT,o2,USDT,0.01,perpetual_futures,vanilla
f2,sell,1,110,0.05,2026-07-02T10:05:00Z,ETHUSDT,o2,USDT,0.01,perpetual_futures,vanilla`;

  const orders = parseDeltaCsv(withMetadata);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].uid, 'delta:ETHUSDT:f2');
  assert.equal(orders[0].contract_value, 0.01);
  assert.equal(orders[0].notional_type, 'VANILLA');
});
