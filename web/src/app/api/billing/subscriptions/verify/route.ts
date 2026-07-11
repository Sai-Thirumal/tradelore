import { NextResponse, type NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { getRazorpayKeySecret } from '@/lib/billing/config.ts';
import { verifyRazorpayCheckoutSignature } from '@/lib/billing/signatures.ts';
import { internalErrorResponse } from '@/lib/errors';
import { rateLimitRequest } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const limited = rateLimitRequest(request);
  if (limited) return limited;

  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const paymentId = typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const subscriptionId = typeof body?.razorpay_subscription_id === 'string' ? body.razorpay_subscription_id : '';
    const signature = typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!paymentId || !subscriptionId || !signature) {
      return NextResponse.json({ error: 'Invalid verification payload.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('id, user_id')
      .eq('provider_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 });

    const valid = verifyRazorpayCheckoutSignature({
      paymentId,
      subscriptionId,
      signature,
      secret: getRazorpayKeySecret(),
    });
    if (!valid) return NextResponse.json({ error: 'Payment verification failed.' }, { status: 400 });

    await supabase.from('billing_subscriptions').update({
      latest_payment_id: paymentId,
      status: 'authenticated',
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);

    return NextResponse.json({ verified: true, authoritative: false });
  } catch (error) {
    return internalErrorResponse(error, 'Unable to verify payment.');
  }
}
