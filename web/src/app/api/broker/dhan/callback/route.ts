import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { consumeDhanConsent } from '@/lib/brokers/india/dhan/client';
import { DHAN_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, upsertBrokerConnection } from '@/lib/db/broker-connections';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';

export const runtime = 'nodejs';

const NEXT_COOKIE = 'dhan_oauth_next';

function redirectHome(request: NextRequest, status: string, nextPath = '/dashboard') {
  const redirectUrl = new URL(getInternalRedirectPath(nextPath), request.nextUrl.origin);
  redirectUrl.searchParams.set('dhan', status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireActiveEntitlement();
  if (response) return response;

  const tokenId = request.nextUrl.searchParams.get('tokenId');
  const cookieStore = await cookies();
  const nextPath = cookieStore.get(NEXT_COOKIE)?.value || '/dashboard';

  if (!tokenId) return redirectHome(request, 'missing_token_id', nextPath);

  try {
    const connection = await fetchBrokerConnection(user.id, DHAN_BROKER);
    if (!hasBrokerCredentials(connection)) {
      return redirectHome(request, 'credentials_required', nextPath);
    }

    const token = await consumeDhanConsent(tokenId, {
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
    });

    await upsertBrokerConnection(user.id, {
      broker_user_id: token.dhanClientId || connection.broker_user_id || '',
      broker_user_name: token.dhanClientName || '',
      encrypted_access_token: encryptSecret(token.accessToken),
      token_expires_at: token.expiryTime,
      last_sync_status: 'connected',
      last_sync_error: '',
    }, DHAN_BROKER);

    const redirect = redirectHome(request, 'connected', nextPath);
    redirect.cookies.delete(NEXT_COOKIE);
    return redirect;
  } catch {
    return redirectHome(request, 'connect_failed', nextPath);
  }
}
