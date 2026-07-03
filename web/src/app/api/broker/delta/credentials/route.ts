import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { isDeltaServerConfigured } from '@/lib/brokers/delta/config';
import {
  DELTA_BROKER,
  saveBrokerCredentials,
} from '@/lib/db/broker-connections';
import { encryptSecret } from '@/lib/security/encryption';
import {
  readJsonObject,
  rejectUnknownFields,
  requiredString,
  validationErrorResponse,
} from '@/lib/validation/request';
import { getErrorMessage } from '@/lib/errors';

export const runtime = 'nodejs';

const CREDENTIAL_FIELDS = ['api_key', 'api_secret'] as const;

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    if (!isDeltaServerConfigured()) {
      return NextResponse.json({ error: 'Delta broker connections are not configured on the server.' }, { status: 503 });
    }

    const body = await readJsonObject(request);
    rejectUnknownFields(body, CREDENTIAL_FIELDS);

    await saveBrokerCredentials(user.id, {
      encrypted_api_key: encryptSecret(requiredString(body, 'api_key', { maxChars: 200 })),
      encrypted_api_secret: encryptSecret(requiredString(body, 'api_secret', { maxChars: 500 })),
    }, DELTA_BROKER);

    return NextResponse.json({ saved: true });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return NextResponse.json({ error: getErrorMessage(error, 'Unable to save Delta credentials.') }, { status: 500 });
  }
}
