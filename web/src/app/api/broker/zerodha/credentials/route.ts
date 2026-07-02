import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { isZerodhaServerConfigured } from '@/lib/brokers/zerodha/config';
import { safeBrokerErrorMessage } from '@/lib/brokers/zerodha/safe-errors';
import {
  BrokerSwitchRequiredError,
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

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    if (!isZerodhaServerConfigured(new URL(request.url).origin)) {
      return NextResponse.json({ error: 'Zerodha broker sync is not configured on the server.' }, { status: 503 });
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
    if (error instanceof BrokerSwitchRequiredError) {
      return NextResponse.json({ error: error.message, blocked_by_broker: error.broker }, { status: 409 });
    }
    return NextResponse.json({ error: safeBrokerErrorMessage(error, 'Unable to save Zerodha credentials.') }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await deleteBrokerCredentials(user.id);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeBrokerErrorMessage(error, 'Unable to delete Zerodha credentials.') }, { status: 500 });
  }
}
