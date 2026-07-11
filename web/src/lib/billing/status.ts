import type { BillingPlan, InternalPlanKey } from './config.ts';
import { getBillingPlan } from './config.ts';

export type EntitlementSource = 'new_user_trial' | 'founding_trader' | 'paid_subscription' | 'manual_admin';
export type SubscriptionStatus = 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired';

export interface BillingSubscriptionRow {
  user_id: string;
  provider_subscription_id: string;
  provider_customer_id?: string | null;
  provider_plan_id: string;
  internal_plan_key: InternalPlanKey;
  billing_interval: 'monthly';
  status: SubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  cancellation_requested_at?: string | null;
  latest_payment_id?: string | null;
  provider_created_at?: string | null;
  last_provider_event_at?: string | null;
}

export interface EntitlementRow {
  source: EntitlementSource;
  status: 'active' | 'expired' | 'revoked';
  starts_at: string;
  expires_at: string | null;
  revoked_at?: string | null;
  reason?: string | null;
}

export interface NormalizedEntitlement {
  hasAccess: boolean;
  accessLevel: 'pro' | 'none';
  source: EntitlementSource | 'none';
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  internalPlanKey: InternalPlanKey | null;
  displayPrice: string | null;
  cancelAtPeriodEnd: boolean;
  reason: string | null;
}

function activeWindow(row: EntitlementRow, now: Date) {
  return row.status === 'active'
    && !row.revoked_at
    && new Date(row.starts_at) <= now
    && (!row.expires_at || new Date(row.expires_at) > now);
}

function subscriptionAccess(row: BillingSubscriptionRow, now: Date) {
  const currentEnd = row.current_period_end ? new Date(row.current_period_end) : null;
  return !!currentEnd && currentEnd > now && (
    row.status === 'active'
    || row.status === 'authenticated'
    || row.status === 'cancelled'
  );
}

function fromSubscription(row: BillingSubscriptionRow, plan: BillingPlan): NormalizedEntitlement {
  return {
    hasAccess: true,
    accessLevel: 'pro',
    source: 'paid_subscription',
    status: row.status,
    startsAt: row.current_period_start || row.provider_created_at || null,
    expiresAt: row.current_period_end || null,
    internalPlanKey: row.internal_plan_key,
    displayPrice: plan.displayPrice,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    reason: null,
  };
}

function expiryScore(expiresAt: string | null) {
  return expiresAt ? new Date(expiresAt).getTime() : Number.POSITIVE_INFINITY;
}

function sourcePriority(source: NormalizedEntitlement['source']) {
  if (source === 'manual_admin') return 4;
  if (source === 'founding_trader') return 3;
  if (source === 'paid_subscription') return 2;
  if (source === 'new_user_trial') return 1;
  return 0;
}

export function evaluateEntitlement(input: {
  entitlements: EntitlementRow[];
  subscriptions: BillingSubscriptionRow[];
  now?: Date;
}): NormalizedEntitlement {
  const now = input.now || new Date();
  const entitlementCandidates = input.entitlements
    .filter((row) => activeWindow(row, now))
    .map((row): NormalizedEntitlement => ({
      hasAccess: true,
      accessLevel: 'pro',
      source: row.source,
      status: row.status,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      internalPlanKey: null,
      displayPrice: null,
      cancelAtPeriodEnd: false,
      reason: row.reason || null,
    }));

  const subscriptionCandidates = input.subscriptions
    .filter((row) => subscriptionAccess(row, now))
    .map((row) => fromSubscription(row, getBillingPlan(row.internal_plan_key)));

  const candidates = [...entitlementCandidates, ...subscriptionCandidates];
  candidates.sort((a, b) => (
    expiryScore(b.expiresAt) - expiryScore(a.expiresAt)
    || sourcePriority(b.source) - sourcePriority(a.source)
  ));
  const winner = candidates[0];
  if (winner) return winner;

  return {
    hasAccess: false,
    accessLevel: 'none',
    source: 'none',
    status: 'none',
    startsAt: null,
    expiresAt: null,
    internalPlanKey: null,
    displayPrice: null,
    cancelAtPeriodEnd: false,
    reason: null,
  };
}

export function mapRazorpayStatus(status: string): SubscriptionStatus | null {
  return ['created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'].includes(status)
    ? status as SubscriptionStatus
    : null;
}

export function dateFromUnix(value: unknown) {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}
