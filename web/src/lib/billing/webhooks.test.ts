import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWebhookEvent, parseRazorpayWebhook } from './webhooks.ts';

test('maps documented webhook events to internal status', () => {
  assert.equal(mapWebhookEvent('subscription.authenticated'), 'authenticated');
  assert.equal(mapWebhookEvent('subscription.activated'), 'active');
  assert.equal(mapWebhookEvent('subscription.charged'), 'active');
  assert.equal(mapWebhookEvent('subscription.pending'), 'pending');
  assert.equal(mapWebhookEvent('subscription.halted'), 'halted');
  assert.equal(mapWebhookEvent('subscription.cancelled'), 'cancelled');
  assert.equal(mapWebhookEvent('subscription.completed'), 'completed');
  assert.equal(mapWebhookEvent('payment.failed'), null);
  assert.equal(mapWebhookEvent('subscription.activated', 'active'), 'active');
  assert.equal(mapWebhookEvent('unknown.event'), null);
});

test('payment.failed follows associated subscription pending status', () => {
  const parsed = parseRazorpayWebhook('failed-pending', {
    id: 'evt_failed_pending',
    event: 'payment.failed',
    created_at: 1_783_728_000,
    payload: {
      subscription: { entity: { id: 'sub_1', status: 'pending' } },
      payment: { entity: { id: 'pay_1', subscription_id: 'sub_1' } },
    },
  });
  assert.equal(parsed.providerSubscriptionId, 'sub_1');
  assert.equal(parsed.status, 'pending');
  assert.equal(parsed.latestPaymentId, 'pay_1');
});

test('payment.failed follows associated subscription halted status', () => {
  const parsed = parseRazorpayWebhook('failed-halted', {
    id: 'evt_failed_halted',
    event: 'payment.failed',
    created_at: 1_783_728_000,
    payload: {
      subscription: { entity: { id: 'sub_1', status: 'halted' } },
      payment: { entity: { id: 'pay_1', subscription_id: 'sub_1' } },
    },
  });
  assert.equal(parsed.status, 'halted');
});

test('payment.failed without resolvable subscription does not invent halted status', () => {
  const parsed = parseRazorpayWebhook('failed-only-payment', {
    id: 'evt_failed_only_payment',
    event: 'payment.failed',
    created_at: 1_783_728_000,
    payload: {
      payment: { entity: { id: 'pay_1' } },
    },
  });
  assert.equal(parsed.providerSubscriptionId, '');
  assert.equal(parsed.status, null);
  assert.equal(parsed.safeErrorMessage, 'Payment failed; subscription status not changed without provider subscription status.');
});

test('subscription.charged after payment.failed carries active status and provider period', () => {
  const failed = parseRazorpayWebhook('failed', {
    id: 'evt_failed',
    event: 'payment.failed',
    created_at: 1_783_728_000,
    payload: { payment: { entity: { id: 'pay_1', subscription_id: 'sub_1' } } },
  });
  const charged = parseRazorpayWebhook('charged', {
    id: 'evt_charged',
    event: 'subscription.charged',
    created_at: 1_783_731_600,
    payload: {
      subscription: { entity: { id: 'sub_1', status: 'active', current_start: 1_783_728_000, current_end: 1_786_320_000 } },
      payment: { entity: { id: 'pay_2', subscription_id: 'sub_1' } },
    },
  });
  assert.equal(failed.status, null);
  assert.equal(charged.status, 'active');
  assert.equal(charged.currentPeriodEnd, '2026-08-10T00:00:00.000Z');
});

test('stale payment.failed can be identified after a newer charged event timestamp', () => {
  const newerCharged = parseRazorpayWebhook('charged', {
    id: 'evt_charged',
    event: 'subscription.charged',
    created_at: 1_783_731_600,
    payload: { subscription: { entity: { id: 'sub_1', status: 'active' } } },
  });
  const olderFailed = parseRazorpayWebhook('failed', {
    id: 'evt_failed',
    event: 'payment.failed',
    created_at: 1_783_728_000,
    payload: { payment: { entity: { id: 'pay_1', subscription_id: 'sub_1' } } },
  });
  assert.ok(new Date(olderFailed.eventCreatedAt) < new Date(newerCharged.eventCreatedAt));
  assert.equal(olderFailed.status, null);
});
