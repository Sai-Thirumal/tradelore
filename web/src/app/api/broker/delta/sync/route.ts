import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { DeltaApiError } from '@/lib/brokers/delta/client';
import { isDeltaServerConfigured } from '@/lib/brokers/delta/config';
import { syncDeltaFills } from '@/lib/brokers/delta/sync';
import { internalErrorResponse } from '@/lib/errors';

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
      if (error.statusCode !== 409 && error.errorType !== 'rate_limit') {
        return internalErrorResponse(error, 'Unable to sync Delta trades.');
      }
      return NextResponse.json({
        error: error.errorType === 'rate_limit' ? `Delta rate limit reached.${retry}` : 'Delta sync is already running for this account.',
        retry_after: error.rateLimitReset,
      }, { status: error.statusCode === 409 ? 409 : error.errorType === 'rate_limit' ? 429 : 500 });
    }
    return internalErrorResponse(error, 'Unable to sync Delta trades.');
  }
}
