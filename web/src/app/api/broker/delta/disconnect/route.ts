import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { DELTA_BROKER } from '@/lib/brokers/core';
import { disconnectBrokerConnection } from '@/lib/db/broker-connections';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(DELTA_BROKER);

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await disconnectBrokerConnection(user.id, broker.id);
    return NextResponse.json({ disconnected: true });
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to disconnect ${broker.displayName}.`);
  }
}
