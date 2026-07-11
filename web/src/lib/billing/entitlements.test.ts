import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAutostartTrial } from './entitlements.ts';

test('does not auto-start trials for existing users before billing launch cutoff', () => {
  assert.equal(shouldAutostartTrial('2026-07-10T23:59:59Z'), false);
  assert.equal(shouldAutostartTrial(undefined), false);
});

test('auto-starts trials for users created after billing launch cutoff', () => {
  assert.equal(shouldAutostartTrial('2026-07-11T00:00:00Z'), true);
  assert.equal(shouldAutostartTrial('2026-07-12T00:00:00Z'), true);
});
