import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import {
  brokerRouteErrorResponse,
  brokerSyncResponse,
  getBrokerAdapterFromRoute,
  unsupportedBrokerResponse,
} from '@/lib/brokers/core';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ broker: string }> }) {
  const broker = await getBrokerAdapterFromRoute(context);
  if (!broker) return unsupportedBrokerResponse();

  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    return brokerSyncResponse(broker, user.id, request);
  } catch (error: unknown) {
    return brokerRouteErrorResponse(broker, error, `Unable to sync ${broker.displayName} trades.`);
  }
}
