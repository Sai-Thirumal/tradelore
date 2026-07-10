import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { exchangeUpstoxCode } from '@/lib/brokers/india/upstox/client';
import { getUpstoxConfig } from '@/lib/brokers/india/upstox/config';
import { UPSTOX_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, upsertBrokerConnection } from '@/lib/db/broker-connections';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';

export const runtime = 'nodejs';

const STATE_COOKIE = 'upstox_oauth_state';
const NEXT_COOKIE = 'upstox_oauth_next';

function redirectHome(request: NextRequest, status: string, nextPath = '/dashboard') {
  const redirectUrl = new URL(nextPath, request.nextUrl.origin);
  redirectUrl.searchParams.set('upstox', status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuthUser();
  if (response) return response;

  const code = request.nextUrl.searchParams.get('code');
  const returnedState = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const nextPath = cookieStore.get(NEXT_COOKIE)?.value || '/dashboard';

  if (!code) return redirectHome(request, 'missing_code', nextPath);
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return redirectHome(request, 'state_error', nextPath);
  }

  try {
    const connection = await fetchBrokerConnection(user.id, UPSTOX_BROKER);
    if (!hasBrokerCredentials(connection)) {
      return redirectHome(request, 'credentials_required', nextPath);
    }

    const token = await exchangeUpstoxCode(code, {
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
      redirectUrl: getUpstoxConfig(request.nextUrl.origin).redirectUrl,
    });

    await upsertBrokerConnection(user.id, {
      broker_user_id: token.user_id || '',
      broker_user_name: token.user_name || token.email || '',
      encrypted_access_token: encryptSecret(token.access_token),
      last_sync_status: 'connected',
      last_sync_error: '',
    }, UPSTOX_BROKER);

    const redirect = redirectHome(request, 'connected', nextPath);
    redirect.cookies.delete(STATE_COOKIE);
    redirect.cookies.delete(NEXT_COOKIE);
    return redirect;
  } catch {
    return redirectHome(request, 'connect_failed', nextPath);
  }
}
