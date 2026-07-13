import { requireActiveEntitlement } from '@/lib/auth/session';
import {
  brokerCredentialsDeleteResponse,
  brokerCredentialsPostResponse,
  brokerRouteErrorResponse,
  getBrokerAdapterFromRoute,
  unsupportedBrokerResponse,
} from '@/lib/brokers/core';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ broker: string }> }) {
  const broker = await getBrokerAdapterFromRoute(context);
  if (!broker) return unsupportedBrokerResponse();

  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    return brokerCredentialsPostResponse(broker, user.id, request);
  } catch (error: unknown) {
    return brokerRouteErrorResponse(broker, error, `Unable to save ${broker.displayName} credentials.`);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ broker: string }> }) {
  const broker = await getBrokerAdapterFromRoute(context);
  if (!broker) return unsupportedBrokerResponse();

  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    return brokerCredentialsDeleteResponse(broker, user.id);
  } catch (error: unknown) {
    return brokerRouteErrorResponse(broker, error, `Unable to delete ${broker.displayName} credentials.`);
  }
}
