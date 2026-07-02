import assert from 'node:assert/strict';
import test from 'node:test';
import { DELTA_AUTO_SYNC_STALE_MS, isDeltaAutoSyncDue } from './autosync.ts';

test('marks Delta auto-sync due only after the stale window', () => {
  const now = Date.parse('2026-07-02T12:00:00.000Z');

  assert.equal(isDeltaAutoSyncDue(null, now), true);
  assert.equal(isDeltaAutoSyncDue(new Date(now - DELTA_AUTO_SYNC_STALE_MS + 1).toISOString(), now), false);
  assert.equal(isDeltaAutoSyncDue(new Date(now - DELTA_AUTO_SYNC_STALE_MS).toISOString(), now), true);
});
