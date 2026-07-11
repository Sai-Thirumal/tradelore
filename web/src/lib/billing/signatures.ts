import { createHmac, timingSafeEqual } from 'node:crypto';

function hmacSha256Hex(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeCompareHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyRazorpayCheckoutSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  secret: string;
}) {
  const expected = hmacSha256Hex(`${input.paymentId}|${input.subscriptionId}`, input.secret);
  return safeCompareHex(input.signature, expected);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  return safeCompareHex(signature, hmacSha256Hex(rawBody, secret));
}

export function webhookEventKey(rawBody: string, eventId?: string) {
  if (eventId) return eventId;
  return hmacSha256Hex(rawBody, 'tradelore-webhook-event-key');
}
