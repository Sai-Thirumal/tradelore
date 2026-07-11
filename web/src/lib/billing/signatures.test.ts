import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { verifyRazorpayCheckoutSignature, verifyRazorpayWebhookSignature, webhookEventKey } from './signatures.ts';

function sig(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

test('validates checkout subscription signatures', () => {
  const secret = 'test_secret';
  const paymentId = 'pay_123';
  const subscriptionId = 'sub_123';
  const signature = sig(`${paymentId}|${subscriptionId}`, secret);
  assert.equal(verifyRazorpayCheckoutSignature({ paymentId, subscriptionId, signature, secret }), true);
  assert.equal(verifyRazorpayCheckoutSignature({ paymentId, subscriptionId, signature: '00', secret }), false);
});

test('validates webhook signature against exact raw body', () => {
  const secret = 'webhook_secret';
  const raw = '{"event":"subscription.activated"}';
  assert.equal(verifyRazorpayWebhookSignature(raw, sig(raw, secret), secret), true);
  assert.equal(verifyRazorpayWebhookSignature(`${raw}\n`, sig(raw, secret), secret), false);
});

test('uses provider event id when present and deterministic fallback otherwise', () => {
  assert.equal(webhookEventKey('body', 'evt_123'), 'evt_123');
  assert.equal(webhookEventKey('body'), webhookEventKey('body'));
  assert.notEqual(webhookEventKey('body'), webhookEventKey('other'));
});
