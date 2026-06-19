import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { KiteApiError } from '@/lib/brokers/zerodha/client';
import { isZerodhaServerConfigured } from '@/lib/brokers/zerodha/config';
import { safeBrokerErrorMessage } from '@/lib/brokers/zerodha/safe-errors';
import { syncZerodhaTrades } from '@/lib/brokers/zerodha/sync';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    if (!isZerodhaServerConfigured(request.nextUrl.origin)) {
      return NextResponse.json({ error: 'Zerodha broker sync is not configured on the server.' }, { status: 503 });
    }

    const result = await syncZerodhaTrades(user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof KiteApiError && error.errorType === 'TokenException') {
      return NextResponse.json({ error: error.message, needs_reconnect: true }, { status: 409 });
    }
    return NextResponse.json({ error: safeBrokerErrorMessage(error) }, { status: 500 });
  }
}
