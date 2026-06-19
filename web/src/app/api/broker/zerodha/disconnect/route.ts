import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { safeBrokerErrorMessage } from '@/lib/brokers/zerodha/safe-errors';
import { disconnectBrokerConnection } from '@/lib/db/broker-connections';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await disconnectBrokerConnection(user.id);
    return NextResponse.json({ disconnected: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeBrokerErrorMessage(error, 'Unable to disconnect Zerodha.') }, { status: 500 });
  }
}
