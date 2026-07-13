import { requireActiveEntitlement } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { DELTA_BROKER } from '@/lib/brokers/core';
import { internalErrorResponse } from '@/lib/errors';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(DELTA_BROKER);

export async function GET() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    return NextResponse.json(await broker.getStatus(user.id));
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to load ${broker.displayName} status.`);
  }
}
