import { NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { DELTA_BROKER } from '@/lib/brokers/core';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(DELTA_BROKER);

export async function POST() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    if (!broker.isServerConfigured()) {
      return NextResponse.json({ error: `${broker.displayName} broker sync is not configured on the server.` }, { status: 503 });
    }

    if (!broker.sync) {
      return NextResponse.json({ error: `${broker.displayName} sync is not supported.` }, { status: 405 });
    }

    return NextResponse.json(await broker.sync(user.id));
  } catch (error: unknown) {
    const mapped = broker.mapSyncError?.(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    return internalErrorResponse(error, `Unable to sync ${broker.displayName} trades.`);
  }
}
