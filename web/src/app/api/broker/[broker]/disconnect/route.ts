import { requireActiveEntitlement } from '@/lib/auth/session';
import {
  brokerDisconnectResponse,
  brokerRouteErrorResponse,
  getBrokerAdapterFromRoute,
  unsupportedBrokerResponse,
} from '@/lib/brokers/core';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ broker: string }> }) {
  const broker = await getBrokerAdapterFromRoute(context);
  if (!broker) return unsupportedBrokerResponse();

  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    return brokerDisconnectResponse(broker, user.id);
  } catch (error: unknown) {
    return brokerRouteErrorResponse(broker, error, `Unable to disconnect ${broker.displayName}.`);
  }
}
