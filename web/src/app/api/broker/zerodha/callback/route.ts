import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { KiteApiError, exchangeRequestToken } from '@/lib/brokers/india/kite/client';
import { getNextKiteTokenExpiry } from '@/lib/brokers/india/kite/session';
import { fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, upsertBrokerConnection } from '@/lib/db/broker-connections';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';

export const runtime = 'nodejs';

const STATE_COOKIE = 'zerodha_oauth_state';
const NEXT_COOKIE = 'zerodha_oauth_next';

function redirectHome(request: NextRequest, status: string, nextPath = '/dashboard') {
  const redirectUrl = new URL(nextPath, request.nextUrl.origin);
  redirectUrl.searchParams.set('zerodha', status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuthUser();
  if (response) return response;

  const requestToken = request.nextUrl.searchParams.get('request_token');
  const returnedState = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const nextPath = cookieStore.get(NEXT_COOKIE)?.value || '/dashboard';

  if (!requestToken) {
    return redirectHome(request, 'missing_request_token', nextPath);
  }

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return redirectHome(request, 'state_error', nextPath);
  }

  try {
    const connection = await fetchBrokerConnection(user.id);
    if (!hasBrokerCredentials(connection)) {
      return redirectHome(request, 'credentials_required', nextPath);
    }

    const token = await exchangeRequestToken(requestToken, {
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
    });

    await upsertBrokerConnection(user.id, {
      broker_user_id: token.user_id,
      broker_user_name: token.user_shortname || token.user_name || '',
      encrypted_access_token: encryptSecret(token.access_token),
      token_expires_at: getNextKiteTokenExpiry(),
      last_sync_status: 'connected',
      last_sync_error: '',
    });

    const redirect = redirectHome(request, 'connected', nextPath);
    redirect.cookies.delete(STATE_COOKIE);
    redirect.cookies.delete(NEXT_COOKIE);
    return redirect;
  } catch (error) {
    if (
      error instanceof KiteApiError
      && error.errorType === 'InputException'
      && error.message.toLowerCase().includes('not enabled for the app')
    ) {
      return redirectHome(request, 'user_not_enabled', nextPath);
    }

    return redirectHome(request, 'connect_failed', nextPath);
  }
}
