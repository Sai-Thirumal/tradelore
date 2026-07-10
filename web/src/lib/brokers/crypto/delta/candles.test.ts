import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseDeltaResolution,
  deltaDateTimeToUnix,
  isDeltaChartExchange,
  normalizeDeltaCandles,
} from './candles.ts';

test('normalizes Delta candles into chart candle shape', () => {
  const candles = normalizeDeltaCandles([
    { time: '2026-07-02T10:00:00Z', open: '100', high: '110', low: '90', close: '105', volume: '12.5' },
  ]);

  assert.deepEqual(candles, [{
    time: 1782986400,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 12.5,
  }]);
});

test('selects Delta route only for Delta exchange', () => {
  assert.equal(isDeltaChartExchange('DELTA'), true);
  assert.equal(isDeltaChartExchange('NSE'), false);
});

test('chooses Delta resolution under the 2000 candle response cap', () => {
  assert.equal(chooseDeltaResolution(60 * 60), '1m');
  assert.equal(chooseDeltaResolution(10 * 24 * 60 * 60), '15m');
});

test('parses Delta datetimes as UTC for markers', () => {
  assert.equal(deltaDateTimeToUnix('2026-07-02 10:00:00'), 1782986400);
});
