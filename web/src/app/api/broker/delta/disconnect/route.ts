import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { DELTA_BROKER, disconnectBrokerConnection } from '@/lib/db/broker-connections';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await disconnectBrokerConnection(user.id, DELTA_BROKER);
    return NextResponse.json({ disconnected: true });
  } catch (error: unknown) {
    return internalErrorResponse(error, 'Unable to disconnect Delta.');
  }
}
