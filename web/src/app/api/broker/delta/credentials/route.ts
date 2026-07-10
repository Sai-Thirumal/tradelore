import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { requireBrokerAdapter } from '@/lib/brokers/core';
import { DELTA_BROKER } from '@/lib/brokers/core';
import { deleteBrokerCredentials, saveBrokerCredentials } from '@/lib/db/broker-connections';
import { encryptSecret } from '@/lib/security/encryption';
import {
  readJsonObject,
  rejectUnknownFields,
  requiredString,
  validationErrorResponse,
} from '@/lib/validation/request';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

const CREDENTIAL_FIELDS = ['api_key', 'api_secret'] as const;
const broker = requireBrokerAdapter(DELTA_BROKER);

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    if (!broker.isServerConfigured()) {
      return NextResponse.json({ error: `${broker.displayName} broker connections are not configured on the server.` }, { status: 503 });
    }

    const body = await readJsonObject(request);
    rejectUnknownFields(body, CREDENTIAL_FIELDS);

    await saveBrokerCredentials(user.id, {
      encrypted_api_key: encryptSecret(requiredString(body, 'api_key', { maxChars: 200 })),
      encrypted_api_secret: encryptSecret(requiredString(body, 'api_secret', { maxChars: 500 })),
    }, broker.id);

    return NextResponse.json({ saved: true });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return internalErrorResponse(error, `Unable to save ${broker.displayName} credentials.`);
  }
}

export async function DELETE() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await deleteBrokerCredentials(user.id, broker.id);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return internalErrorResponse(error, `Unable to delete ${broker.displayName} credentials.`);
  }
}
