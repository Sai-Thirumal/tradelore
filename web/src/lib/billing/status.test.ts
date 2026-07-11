import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateEntitlement, mapRazorpayStatus, type EntitlementRow, type BillingSubscriptionRow } from './status.ts';

process.env.RAZORPAY_LAUNCH_MONTHLY_PLAN_ID = 'plan_launch';
process.env.RAZORPAY_STANDARD_MONTHLY_PLAN_ID = 'plan_standard';

const now = new Date('2026-07-11T00:00:00Z');

function entitlement(source: EntitlementRow['source'], starts = '2026-07-01T00:00:00Z', expires = '2026-08-01T00:00:00Z'): EntitlementRow {
  return { source, status: 'active', starts_at: starts, expires_at: expires };
}

function subscription(status: BillingSubscriptionRow['status'], currentEnd = '2026-08-11T00:00:00Z'): BillingSubscriptionRow {
  return {
    user_id: 'user_1',
    provider_subscription_id: 'sub_1',
    provider_plan_id: 'plan_standard',
    internal_plan_key: 'pro_standard_monthly',
    billing_interval: 'monthly',
    status,
    current_period_end: currentEnd,
  };
}

test('active 30-day trial grants access and expires', () => {
  const active = evaluateEntitlement({ entitlements: [entitlement('new_user_trial')], subscriptions: [], now });
  assert.equal(active.hasAccess, true);
  assert.equal(active.source, 'new_user_trial');

  const expired = evaluateEntitlement({
    entitlements: [entitlement('new_user_trial', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z')],
    subscriptions: [],
    now,
  });
  assert.equal(expired.hasAccess, false);
});

test('founding entitlement wins over trial without shortening access', () => {
  const result = evaluateEntitlement({
    entitlements: [
      entitlement('new_user_trial', '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z'),
      entitlement('founding_trader', '2026-07-01T00:00:00Z', '2027-01-01T00:00:00Z'),
    ],
    subscriptions: [],
    now,
  });
  assert.equal(result.source, 'founding_trader');
  assert.equal(result.expiresAt, '2027-01-01T00:00:00Z');
});

test('chooses active paid period when trial ends earlier', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('new_user_trial', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z')],
    subscriptions: [subscription('active', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'paid_subscription');
  assert.equal(result.expiresAt, '2026-08-11T00:00:00Z');
});

test('chooses trial when it legitimately ends after paid period', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('new_user_trial', '2026-07-01T00:00:00Z', '2026-09-01T00:00:00Z')],
    subscriptions: [subscription('active', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'new_user_trial');
  assert.equal(result.expiresAt, '2026-09-01T00:00:00Z');
});

test('chooses founding entitlement when it ends after subscription', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('founding_trader', '2026-07-01T00:00:00Z', '2027-01-01T00:00:00Z')],
    subscriptions: [subscription('active', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'founding_trader');
  assert.equal(result.expiresAt, '2027-01-01T00:00:00Z');
});

test('chooses subscription when founding entitlement ends earlier', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('founding_trader', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z')],
    subscriptions: [subscription('active', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'paid_subscription');
  assert.equal(result.expiresAt, '2026-08-11T00:00:00Z');
});

test('chooses furthest expiry for manual entitlement and paid subscription overlap', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('manual_admin', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z')],
    subscriptions: [subscription('active', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'paid_subscription');
  assert.equal(result.expiresAt, '2026-08-11T00:00:00Z');
});

test('chooses cancelled subscription over trial when its current period ends later', () => {
  const result = evaluateEntitlement({
    entitlements: [entitlement('new_user_trial', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z')],
    subscriptions: [subscription('cancelled', '2026-08-11T00:00:00Z')],
    now,
  });
  assert.equal(result.source, 'paid_subscription');
  assert.equal(result.status, 'cancelled');
  assert.equal(result.expiresAt, '2026-08-11T00:00:00Z');
});

test('cancelled subscriptions keep access through current period only', () => {
  const active = evaluateEntitlement({ entitlements: [], subscriptions: [subscription('cancelled')], now });
  assert.equal(active.hasAccess, true);
  assert.equal(active.source, 'paid_subscription');

  const ended = evaluateEntitlement({
    entitlements: [],
    subscriptions: [subscription('cancelled', '2026-07-01T00:00:00Z')],
    now,
  });
  assert.equal(ended.hasAccess, false);
});

test('maps only documented Razorpay subscription statuses', () => {
  assert.equal(mapRazorpayStatus('authenticated'), 'authenticated');
  assert.equal(mapRazorpayStatus('active'), 'active');
  assert.equal(mapRazorpayStatus('made_up'), null);
});
