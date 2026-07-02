import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDeltaFundingToTrades, normalizeDeltaFundingTransactions } from './funding.ts';
import type { TradeRecord } from '../../types/trading.ts';

function trade(overrides: Partial<TradeRecord>): TradeRecord {
  return {
    broker: 'delta',
    symbol: 'BTCUSDT',
    exchange: 'DELTA',
    segment: 'PERP',
    product_id: 27,
    product_symbol: 'BTCUSDT',
    settlement_asset: 'USDT',
    direction: 'LONG',
    qty: 1,
    avg_entry: 100,
    avg_exit: 110,
    pnl: 10,
    commission: 1,
    funding: 0,
    pnl_currency: 'USDT',
    entry_time: '2026-07-02 09:00:00',
    exit_time: '2026-07-02 10:00:00',
    trade_date: '2026-07-02',
    result: 'win',
    ...overrides,
  };
}

test('normalizes only Delta funding wallet transactions', () => {
  const funding = normalizeDeltaFundingTransactions([
    { id: 'fund-1', transaction_type: 'funding', amount: '1.25', asset_symbol: 'USDT', product_id: 27, product_symbol: 'BTCUSDT', created_at: '2026-07-02T08:00:00Z' },
    { id: 'dep-1', transaction_type: 'deposit', amount: '100', asset_symbol: 'USDT', created_at: '2026-07-02T08:00:00Z' },
    { id: 'wd-1', transaction_type: 'withdrawal', amount: '-50', asset_symbol: 'USDT', created_at: '2026-07-02T08:00:00Z' },
    { id: 'conv-1', transaction_type: 'conversion', amount: '2', asset_symbol: 'USDT', created_at: '2026-07-02T08:00:00Z' },
    { id: 'comm-1', transaction_type: 'commission', amount: '-0.1', asset_symbol: 'USDT', created_at: '2026-07-02T08:00:00Z' },
  ]);

  assert.equal(funding.length, 1);
  assert.equal(funding[0].external_transaction_id, 'fund-1');
  assert.equal(funding[0].amount, 1.25);
});

test('aggregates funding by day product currency and assigns once', () => {
  const trades = [
    trade({ exit_time: '2026-07-02 10:00:00' }),
    trade({ exit_time: '2026-07-02 11:00:00' }),
    trade({ product_id: 28, product_symbol: 'ETHUSDT', symbol: 'ETHUSDT', exit_time: '2026-07-02 12:00:00' }),
  ];
  const funding = normalizeDeltaFundingTransactions([
    { id: 'fund-1', transaction_type: 'funding', amount: '1.25', asset_symbol: 'USDT', product_id: 27, product_symbol: 'BTCUSDT', created_at: '2026-07-02T08:00:00Z' },
    { id: 'fund-2', transaction_type: 'funding', amount: '-0.5', asset_symbol: 'USDT', product_id: 27, product_symbol: 'BTCUSDT', created_at: '2026-07-02T09:00:00Z' },
  ]);

  const result = applyDeltaFundingToTrades(trades, funding);

  assert.equal(result[0].funding, 0);
  assert.equal(result[1].funding, 0.75);
  assert.equal(result[2].funding, 0);
  assert.equal(result.reduce((sum, t) => sum + Number(t.funding || 0), 0), 0.75);
});
