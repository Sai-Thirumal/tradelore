import { createServiceClient } from '../supabase/service.ts';
import { dateFromUnix, mapRazorpayStatus, type SubscriptionStatus } from './status.ts';
import { webhookEventKey } from './signatures.ts';

const EVENT_NAMES = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'payment.failed',
]);

function getObject(payload: Record<string, unknown>, path: string[]) {
  let value: unknown = payload;
  for (const key of path) {
    if (!value || typeof value !== 'object') return null;
    value = (value as Record<string, unknown>)[key];
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function mapWebhookEvent(event: string, providerStatus?: string) {
  if (providerStatus) return mapRazorpayStatus(providerStatus);
  if (event === 'subscription.authenticated') return 'authenticated';
  if (event === 'subscription.activated' || event === 'subscription.charged') return 'active';
  if (event === 'subscription.pending') return 'pending';
  if (event === 'subscription.halted') return 'halted';
  if (event === 'subscription.cancelled') return 'cancelled';
  if (event === 'subscription.completed') return 'completed';
  return null;
}

export function parseRazorpayWebhook(rawBody: string, payload: Record<string, unknown>) {
  const event = typeof payload.event === 'string' ? payload.event : '';
  const eventId = typeof payload.id === 'string' ? payload.id : undefined;
  const eventKey = webhookEventKey(rawBody, eventId);
  const sub = getObject(payload, ['payload', 'subscription', 'entity']);
  const payment = getObject(payload, ['payload', 'payment', 'entity']);
  const providerSubscriptionId = typeof sub?.id === 'string'
    ? sub.id
    : typeof payment?.subscription_id === 'string' ? payment.subscription_id : '';
  const providerStatus = typeof sub?.status === 'string' ? sub.status : undefined;
  const status = EVENT_NAMES.has(event)
    ? mapWebhookEvent(event, providerStatus) as SubscriptionStatus | null
    : null;

  const eventCreated = typeof payload.created_at === 'number' ? new Date(payload.created_at * 1000).toISOString() : null;
  return {
    event,
    eventKey,
    knownEvent: EVENT_NAMES.has(event),
    providerSubscriptionId,
    status,
    providerCustomerId: typeof sub?.customer_id === 'string' ? sub.customer_id : null,
    currentPeriodStart: dateFromUnix(sub?.current_start),
    currentPeriodEnd: dateFromUnix(sub?.current_end),
    cancelledAt: event === 'subscription.cancelled' ? eventCreated || new Date().toISOString() : null,
    endedAt: dateFromUnix(sub?.ended_at),
    latestPaymentId: typeof payment?.id === 'string' ? payment.id : null,
    providerCreatedAt: dateFromUnix(sub?.created_at),
    eventCreatedAt: eventCreated || new Date().toISOString(),
    safeErrorCode: EVENT_NAMES.has(event) ? null : 'unknown_event',
    safeErrorMessage: event === 'payment.failed' && !providerStatus
      ? 'Payment failed; subscription status not changed without provider subscription status.'
      : null,
  };
}

export async function processRazorpayWebhook(rawBody: string, payload: Record<string, unknown>) {
  const parsed = parseRazorpayWebhook(rawBody, payload);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('process_razorpay_billing_webhook', {
    p_event_key: parsed.eventKey,
    p_event_type: parsed.event || 'unknown',
    p_provider_object_id: parsed.providerSubscriptionId || null,
    p_known_event: parsed.knownEvent,
    p_status: parsed.status,
    p_provider_customer_id: parsed.providerCustomerId,
    p_current_period_start: parsed.currentPeriodStart,
    p_current_period_end: parsed.currentPeriodEnd,
    p_cancelled_at: parsed.cancelledAt,
    p_ended_at: parsed.endedAt,
    p_latest_payment_id: parsed.latestPaymentId,
    p_provider_created_at: parsed.providerCreatedAt,
    p_provider_event_created_at: parsed.eventCreatedAt,
    p_safe_error_code: parsed.safeErrorCode,
    p_safe_error_message: parsed.safeErrorMessage,
  });
  if (error) throw error;
  return { result: data };
}
