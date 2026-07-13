import { NextRequest, NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { ZERODHA_BROKER } from '@/lib/brokers/core';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(ZERODHA_BROKER);

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    if (!broker.isServerConfigured({ origin: request.nextUrl.origin })) {
      return NextResponse.json({ error: `${broker.displayName} broker sync is not configured on the server.` }, { status: 503 });
    }

    if (!broker.sync) {
      return NextResponse.json({ error: `${broker.displayName} sync is not supported.` }, { status: 405 });
    }

    const result = await broker.sync(user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const mapped = broker.mapSyncError?.(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    return internalErrorResponse(error, `Unable to sync ${broker.displayName} trades.`);
  }
}
