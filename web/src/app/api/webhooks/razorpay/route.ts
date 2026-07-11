import { NextResponse, type NextRequest } from 'next/server';
import { getRazorpayWebhookSecret } from '@/lib/billing/config.ts';
import { verifyRazorpayWebhookSignature } from '@/lib/billing/signatures.ts';
import { processRazorpayWebhook } from '@/lib/billing/webhooks.ts';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature') || '';
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });

  const rawBody = await request.text();
  if (!verifyRazorpayWebhookSignature(rawBody, signature, getRazorpayWebhookSecret())) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON.' }, { status: 400 });
  }

  try {
    await processRazorpayWebhook(rawBody, payload);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Unable to process Razorpay webhook.', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
