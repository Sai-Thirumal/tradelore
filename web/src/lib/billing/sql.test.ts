import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('sql/07_billing_foundation.sql', 'utf8');

test('migration includes database-level duplicate subscription protection', () => {
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_one_open_per_user/);
  assert.match(sql, /WHERE status IN \('created', 'authenticated', 'active', 'pending', 'halted'\)/);
});

test('webhook processing RPC is locked down to service role', () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = public/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.process_razorpay_billing_webhook/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.process_razorpay_billing_webhook/);
  assert.match(sql, /TO service_role/);
});
