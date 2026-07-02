import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { DELTA_BROKER, deleteBrokerCredentials } from '@/lib/db/broker-connections';
import { getErrorMessage } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await deleteBrokerCredentials(user.id, DELTA_BROKER);
    return NextResponse.json({ disconnected: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, 'Unable to disconnect Delta.') }, { status: 500 });
  }
}
