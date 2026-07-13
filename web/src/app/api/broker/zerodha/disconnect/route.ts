import { NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { internalErrorResponse } from '@/lib/errors';
import { disconnectBrokerConnection } from '@/lib/db/broker-connections';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { ZERODHA_BROKER } from '@/lib/brokers/core';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(ZERODHA_BROKER);

export async function POST() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    await disconnectBrokerConnection(user.id, broker.id);
    return NextResponse.json({ disconnected: true });
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to disconnect ${broker.displayName}.`);
  }
}
