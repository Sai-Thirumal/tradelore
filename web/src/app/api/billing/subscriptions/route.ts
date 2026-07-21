import { NextResponse, type NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { getRazorpayKeyId, parseInternalPlanKey, getBillingPlan } from '@/lib/billing/config.ts';
import { createRazorpayClient } from '@/lib/billing/razorpay.ts';
import { internalErrorResponse } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';

const MONTHLY_TOTAL_COUNT = 1200; // Razorpay requires a bounded subscription; 100 years is its documented maximum.

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const payload = await request.json().catch(() => null) as { plan?: unknown } | null;
    const key = parseInternalPlanKey(payload?.plan);
    if (!key) return NextResponse.json({ error: 'Invalid billing plan.' }, { status: 400 });

    const plan = getBillingPlan(key);
    if (!plan.available) return NextResponse.json({ error: 'This plan is not available.' }, { status: 403 });

    const supabase = createServiceClient();
    const { data: existing, error: existingError } = await supabase
      .from('billing_subscriptions')
      .select('provider_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['created', 'authenticated', 'active', 'pending', 'halted'])
      .limit(1);
    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'An active subscription already exists.' }, { status: 409 });
    }

    const provider = await createRazorpayClient().createSubscription({
      planId: plan.providerPlanId,
      totalCount: MONTHLY_TOTAL_COUNT,
      notes: {
        app: 'tradelore',
        user_id: user.id,
        internal_plan_key: plan.key,
      },
    });

    const { error: insertError } = await supabase.from('billing_subscriptions').insert({
      user_id: user.id,
      provider: 'razorpay',
      provider_subscription_id: provider.id,
      provider_customer_id: provider.customer_id || null,
      provider_plan_id: plan.providerPlanId,
      internal_plan_key: plan.key,
      billing_interval: 'monthly',
      status: provider.status,
      current_period_start: null,
      current_period_end: null,
      provider_created_at: provider.created_at ? new Date(provider.created_at * 1000).toISOString() : null,
    });
    if (insertError) throw insertError;

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      providerSubscriptionId: provider.id,
      planDisplayName: plan.displayName,
      displayPrice: plan.displayPrice,
      prefill: {
        email: user.email || '',
      },
    });
  } catch (error) {
    return internalErrorResponse(error, 'Unable to create subscription.');
  }
}
