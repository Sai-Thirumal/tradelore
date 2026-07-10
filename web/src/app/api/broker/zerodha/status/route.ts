import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { ZERODHA_BROKER } from '@/lib/brokers/core';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
const broker = requireBrokerAdapter(ZERODHA_BROKER);

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    return NextResponse.json(await broker.getStatus(user.id, { origin: request.nextUrl.origin }));
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to load ${broker.displayName} status.`);
  }
}
