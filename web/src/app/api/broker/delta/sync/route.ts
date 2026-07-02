import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { DeltaApiError } from '@/lib/brokers/delta/client';
import { isDeltaServerConfigured } from '@/lib/brokers/delta/config';
import { syncDeltaFills } from '@/lib/brokers/delta/sync';
import { getErrorMessage } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    if (!isDeltaServerConfigured()) {
      return NextResponse.json({ error: 'Delta broker sync is not configured on the server.' }, { status: 503 });
    }

    return NextResponse.json(await syncDeltaFills(user.id));
  } catch (error: unknown) {
    if (error instanceof DeltaApiError) {
      const retry = error.errorType === 'rate_limit'
        ? error.rateLimitReset
          ? ` Delta rate limit resets at ${error.rateLimitReset}.`
          : ' Please retry in a minute.'
        : '';
      return NextResponse.json({
        error: `${error.message}${retry}`,
        retry_after: error.rateLimitReset,
      }, { status: error.statusCode === 409 ? 409 : error.errorType === 'rate_limit' ? 429 : 500 });
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
