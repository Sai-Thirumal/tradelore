import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { createKiteLoginUrl } from '@/lib/brokers/india/kite/client';
import { isZerodhaServerConfigured } from '@/lib/brokers/india/kite/config';
import { fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials } from '@/lib/db/broker-connections';

export const runtime = 'nodejs';

const STATE_COOKIE = 'zerodha_oauth_state';
const NEXT_COOKIE = 'zerodha_oauth_next';

export async function GET(request: NextRequest) {
  const { user, response } = await requireActiveEntitlement();
  if (response) return response;

  const origin = request.nextUrl.origin;
  try {
    if (!isZerodhaServerConfigured(origin)) {
      return NextResponse.redirect(new URL('/?zerodha=not_configured', origin));
    }

    const connection = await fetchBrokerConnection(user.id);
    if (!hasBrokerCredentials(connection)) {
      return NextResponse.redirect(new URL('/settings/zerodha?zerodha=credentials_required', origin));
    }

    const state = randomBytes(24).toString('base64url');
    const nextPath = getInternalRedirectPath(request.nextUrl.searchParams.get('next') || '/dashboard');
    const loginUrl = createKiteLoginUrl(getBrokerApiKey(connection), state);

    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/zerodha',
      maxAge: 10 * 60,
    });
    redirect.cookies.set(NEXT_COOKIE, nextPath, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/zerodha',
      maxAge: 10 * 60,
    });
    return redirect;
  } catch {
    return NextResponse.redirect(new URL('/?zerodha=connect_failed', origin));
  }
}
