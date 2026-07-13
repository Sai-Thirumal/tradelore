import { NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { ZERODHA_BROKER } from '@/lib/brokers/core';
import { internalErrorResponse } from '@/lib/errors';
import {
  deleteBrokerCredentials,
  saveBrokerCredentials,
} from '@/lib/db/broker-connections';
import { encryptSecret } from '@/lib/security/encryption';
import {
  readJsonObject,
  rejectUnknownFields,
  requiredString,
  validationErrorResponse,
} from '@/lib/validation/request';

export const runtime = 'nodejs';

const CREDENTIAL_FIELDS = ['api_key', 'api_secret'] as const;
const broker = requireBrokerAdapter(ZERODHA_BROKER);

export async function POST(request: Request) {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    if (!broker.isServerConfigured({ origin: new URL(request.url).origin })) {
      return NextResponse.json({ error: `${broker.displayName} broker sync is not configured on the server.` }, { status: 503 });
    }

    const body = await readJsonObject(request);
    rejectUnknownFields(body, CREDENTIAL_FIELDS);

    const apiKey = requiredString(body, 'api_key', { maxChars: 100 });
    const apiSecret = requiredString(body, 'api_secret', { maxChars: 200 });

    await saveBrokerCredentials(user.id, {
      encrypted_api_key: encryptSecret(apiKey),
      encrypted_api_secret: encryptSecret(apiSecret),
    });

    return NextResponse.json({ saved: true });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return internalErrorResponse(error, `Unable to save ${broker.displayName} credentials.`);
  }
}

export async function DELETE() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    await deleteBrokerCredentials(user.id, broker.id);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to delete ${broker.displayName} credentials.`);
  }
}
