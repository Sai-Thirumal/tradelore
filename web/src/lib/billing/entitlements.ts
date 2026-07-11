import { createServiceClient } from '../supabase/service.ts';
import { evaluateEntitlement, type BillingSubscriptionRow, type EntitlementRow } from './status.ts';

const TRIAL_AUTOSTART_CUTOFF = new Date('2026-07-11T00:00:00Z');

export function shouldAutostartTrial(userCreatedAt?: string) {
  return Boolean(userCreatedAt && new Date(userCreatedAt) >= TRIAL_AUTOSTART_CUTOFF);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export async function ensureNewUserTrial(userId: string, userCreatedAt?: string) {
  if (!shouldAutostartTrial(userCreatedAt)) return;

  const supabase = createServiceClient();
  const { data: existing, error: readError } = await supabase
    .from('user_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'new_user_trial')
    .limit(1);

  if (readError) throw readError;
  if (existing && existing.length > 0) return;

  const { error } = await supabase
    .from('user_entitlements')
    .insert({
      user_id: userId,
      source: 'new_user_trial',
      status: 'active',
      starts_at: new Date().toISOString(),
      expires_at: daysFromNow(30),
      reason: 'first_authenticated_application_entry',
    });

  if (error && error.code !== '23505') throw error;
}

export async function getUserEntitlement(userId: string) {
  const supabase = createServiceClient();
  const [{ data: entitlements, error: entitlementError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    supabase
      .from('user_entitlements')
      .select('source, status, starts_at, expires_at, revoked_at, reason')
      .eq('user_id', userId),
    supabase
      .from('billing_subscriptions')
      .select('user_id, provider_subscription_id, provider_customer_id, provider_plan_id, internal_plan_key, billing_interval, status, current_period_start, current_period_end, cancel_at_period_end, cancellation_requested_at, latest_payment_id, provider_created_at, last_provider_event_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (entitlementError) throw entitlementError;
  if (subscriptionError) throw subscriptionError;
  return evaluateEntitlement({
    entitlements: (entitlements || []) as EntitlementRow[],
    subscriptions: (subscriptions || []) as BillingSubscriptionRow[],
  });
}
