import assert from 'node:assert/strict';
import test from 'node:test';
import { latestTradeMonths, latestTradeRetentionKeysByBroker, tradeMonth, tradeRetentionKey } from './trade-retention.ts';

test('keeps the latest six trade months from the user data', () => {
  const orders = [
    { trade_time: '2026-01-31 09:15:00' },
    { trade_time: '2026-02-01 09:15:00' },
    { trade_time: '2026-03-01 09:15:00' },
    { trade_time: '2026-04-01 09:15:00' },
    { trade_time: '2026-05-01 09:15:00' },
    { trade_time: '2026-06-01 09:15:00' },
    { trade_time: '2026-07-01 09:15:00' },
  ];
  const months = latestTradeMonths(orders);

  assert.deepEqual([...months], ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
  assert.equal(months.has(tradeMonth({ trade_time: '2026-01-31 09:15:00' })), false);
  assert.equal(months.has(tradeMonth({ trade_time: '2026-04-30 15:30:00' })), true);
});

test('keeps the latest six trade months for each broker', () => {
  const orders = [
    { broker: 'zerodha', trade_time: '2026-01-31 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-02-01 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-03-01 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-04-01 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-05-01 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-06-01 09:15:00' },
    { broker: 'zerodha', trade_time: '2026-07-01 09:15:00' },
    { broker: 'delta', trade_time: '2026-07-01T09:15:00Z' },
    { broker: 'delta', trade_time: '2026-08-01T09:15:00Z' },
    { broker: 'delta', trade_time: '2026-09-01T09:15:00Z' },
    { broker: 'delta', trade_time: '2026-10-01T09:15:00Z' },
    { broker: 'delta', trade_time: '2026-11-01T09:15:00Z' },
    { broker: 'delta', trade_time: '2026-12-01T09:15:00Z' },
  ];
  const keys = latestTradeRetentionKeysByBroker(orders);

  assert.equal(keys.has(tradeRetentionKey({ broker: 'zerodha', trade_time: '2026-01-31 09:15:00' })), false);
  assert.equal(keys.has(tradeRetentionKey({ broker: 'zerodha', trade_time: '2026-02-01 09:15:00' })), true);
  assert.equal(keys.has(tradeRetentionKey({ broker: 'delta', trade_time: '2026-07-01T09:15:00Z' })), true);
  assert.equal(keys.has(tradeRetentionKey({ broker: 'delta', trade_time: '2026-12-01T09:15:00Z' })), true);
  assert.equal(keys.size, 12);
});
