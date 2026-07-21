import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { createRazorpayClient } from '@/lib/billing/razorpay.ts';
import { internalErrorResponse } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const supabase = createServiceClient();
    const { data: subscription, error } = await supabase
      .from('billing_subscriptions')
      .select('id, provider_subscription_id, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .in('status', ['authenticated', 'active', 'pending', 'halted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!subscription) return NextResponse.json({ error: 'No cancellable subscription found.' }, { status: 404 });
    if (subscription.cancel_at_period_end) return NextResponse.json({ cancelledAtPeriodEnd: true });

    await createRazorpayClient().cancelSubscription(subscription.provider_subscription_id, true);
    await supabase.from('billing_subscriptions').update({
      cancel_at_period_end: true,
      cancellation_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', subscription.id);

    return NextResponse.json({ cancelledAtPeriodEnd: true });
  } catch (error) {
    return internalErrorResponse(error, 'Unable to cancel subscription.');
  }
}
