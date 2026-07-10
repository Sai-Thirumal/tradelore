import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import {
  brokerRouteErrorResponse,
  brokerStatusResponse,
  getBrokerAdapterFromRoute,
  unsupportedBrokerResponse,
} from '@/lib/brokers/core';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ broker: string }> }) {
  const broker = await getBrokerAdapterFromRoute(context);
  if (!broker) return unsupportedBrokerResponse();

  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    return brokerStatusResponse(broker, user.id, request);
  } catch (error: unknown) {
    return brokerRouteErrorResponse(broker, error, `Unable to load ${broker.displayName} status.`);
  }
}
