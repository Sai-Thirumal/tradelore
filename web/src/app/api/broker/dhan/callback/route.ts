import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { consumeDhanConsent } from '@/lib/brokers/india/dhan/client';
import { DHAN_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, upsertBrokerConnection } from '@/lib/db/broker-connections';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';

export const runtime = 'nodejs';

const NEXT_COOKIE = 'dhan_oauth_next';
const STARTED_COOKIE = 'dhan_oauth_started';

function redirectHome(request: NextRequest, status: string, nextPath = '/dashboard') {
  const redirectUrl = new URL(getInternalRedirectPath(nextPath), request.nextUrl.origin);
  redirectUrl.searchParams.set('dhan', status);
  const redirect = NextResponse.redirect(redirectUrl);
  redirect.cookies.delete(NEXT_COOKIE);
  redirect.cookies.delete(STARTED_COOKIE);
  return redirect;
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireActiveEntitlement();
  if (response) return response;

  const tokenId = request.nextUrl.searchParams.get('tokenId');
  const cookieStore = await cookies();
  const nextPath = cookieStore.get(NEXT_COOKIE)?.value || '/dashboard';
  const loginStarted = cookieStore.get(STARTED_COOKIE)?.value === '1';

  if (!tokenId) return redirectHome(request, 'missing_token_id', nextPath);
  if (!loginStarted) return redirectHome(request, 'state_error', nextPath);

  try {
    const connection = await fetchBrokerConnection(user.id, DHAN_BROKER);
    if (!hasBrokerCredentials(connection) || !connection.broker_user_id) {
      return redirectHome(request, 'credentials_required', nextPath);
    }

    const token = await consumeDhanConsent(tokenId, {
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
    });

    if (token.dhanClientId !== connection.broker_user_id) {
      return redirectHome(request, 'client_mismatch', nextPath);
    }

    await upsertBrokerConnection(user.id, {
      broker_user_id: token.dhanClientId,
      broker_user_name: token.dhanClientName || '',
      encrypted_access_token: encryptSecret(token.accessToken),
      token_expires_at: token.expiryTime,
      last_sync_status: 'connected',
      last_sync_error: '',
    }, DHAN_BROKER);

    return redirectHome(request, 'connected', nextPath);
  } catch {
    return redirectHome(request, 'connect_failed', nextPath);
  }
}
