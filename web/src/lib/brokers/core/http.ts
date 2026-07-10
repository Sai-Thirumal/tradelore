import { NextRequest, NextResponse } from 'next/server';
import { getBrokerAdapter } from './registry.ts';
import type { BrokerAdapter } from './types.ts';
import { deleteBrokerCredentials, disconnectBrokerConnection, saveBrokerCredentials } from '../../db/broker-connections.ts';
import { encryptSecret } from '../../security/encryption.ts';
import {
  readJsonObject,
  rejectUnknownFields,
  requiredString,
  validationErrorResponse,
} from '../../validation/request.ts';
import { internalErrorResponse } from '../../errors.ts';

interface BrokerRouteContext {
  params: Promise<{ broker: string }> | { broker: string };
}

export async function getBrokerAdapterFromRoute(context: BrokerRouteContext) {
  const params = await context.params;
  return getBrokerAdapter(params.broker);
}

export function unsupportedBrokerResponse() {
  return NextResponse.json({ error: 'Unsupported broker.' }, { status: 404 });
}

export async function saveBrokerCredentialsFromRequest(
  broker: BrokerAdapter,
  userId: string,
  request: Request,
) {
  const body = await readJsonObject(request);
  const fieldKeys = broker.credentialFields.map((field) => field.key);
  rejectUnknownFields(body, fieldKeys);

  const apiKeyField = broker.credentialFields.find((field) => field.key === 'api_key');
  const apiSecretField = broker.credentialFields.find((field) => field.key === 'api_secret');

  if (!apiKeyField || !apiSecretField) {
    throw new Error(`${broker.displayName} API key/secret credentials are not configured.`);
  }

  await saveBrokerCredentials(userId, {
    encrypted_api_key: encryptSecret(requiredString(body, apiKeyField.key, { maxChars: apiKeyField.maxChars })),
    encrypted_api_secret: encryptSecret(requiredString(body, apiSecretField.key, { maxChars: apiSecretField.maxChars })),
  }, broker.id);
}

export async function brokerStatusResponse(
  broker: BrokerAdapter,
  userId: string,
  request: NextRequest,
) {
  return NextResponse.json(await broker.getStatus(userId, { origin: request.nextUrl.origin }));
}

export async function brokerCredentialsPostResponse(
  broker: BrokerAdapter,
  userId: string,
  request: Request,
) {
  if (!broker.isServerConfigured({ origin: new URL(request.url).origin })) {
    return NextResponse.json({ error: `${broker.displayName} broker connections are not configured on the server.` }, { status: 503 });
  }

  await saveBrokerCredentialsFromRequest(broker, userId, request);
  return NextResponse.json({ saved: true });
}

export async function brokerCredentialsDeleteResponse(broker: BrokerAdapter, userId: string) {
  await deleteBrokerCredentials(userId, broker.id);
  return NextResponse.json({ deleted: true });
}

export async function brokerDisconnectResponse(broker: BrokerAdapter, userId: string) {
  await disconnectBrokerConnection(userId, broker.id);
  return NextResponse.json({ disconnected: true });
}

export async function brokerSyncResponse(broker: BrokerAdapter, userId: string, request: NextRequest) {
  if (!broker.isServerConfigured({ origin: request.nextUrl.origin })) {
    return NextResponse.json({ error: `${broker.displayName} broker sync is not configured on the server.` }, { status: 503 });
  }

  if (!broker.sync) {
    return NextResponse.json({ error: `${broker.displayName} sync is not supported.` }, { status: 405 });
  }

  try {
    return NextResponse.json(await broker.sync(userId));
  } catch (error: unknown) {
    const mapped = broker.mapSyncError?.(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    throw error;
  }
}

export function brokerRouteErrorResponse(broker: BrokerAdapter, error: unknown, fallbackMessage: string) {
  const validationResponse = validationErrorResponse(error);
  if (validationResponse) return validationResponse;

  return internalErrorResponse(error, fallbackMessage);
}
