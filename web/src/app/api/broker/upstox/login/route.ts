import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { createUpstoxLoginUrl } from '@/lib/brokers/india/upstox/client';
import { getUpstoxConfig, isUpstoxServerConfigured } from '@/lib/brokers/india/upstox/config';
import { UPSTOX_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials } from '@/lib/db/broker-connections';

export const runtime = 'nodejs';

const STATE_COOKIE = 'upstox_oauth_state';
const NEXT_COOKIE = 'upstox_oauth_next';

export async function GET(request: NextRequest) {
  const { user, response } = await requireActiveEntitlement();
  if (response) return response;

  const origin = request.nextUrl.origin;
  try {
    if (!isUpstoxServerConfigured(origin)) {
      return NextResponse.redirect(new URL('/?upstox=not_configured', origin));
    }

    const connection = await fetchBrokerConnection(user.id, UPSTOX_BROKER);
    if (!hasBrokerCredentials(connection)) {
      return NextResponse.redirect(new URL('/settings/upstox?upstox=credentials_required', origin));
    }

    const state = randomBytes(24).toString('base64url');
    const nextPath = getInternalRedirectPath(request.nextUrl.searchParams.get('next') || '/dashboard');
    const loginUrl = createUpstoxLoginUrl(getBrokerApiKey(connection), getUpstoxConfig(origin).redirectUrl, state);

    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/upstox',
      maxAge: 10 * 60,
    });
    redirect.cookies.set(NEXT_COOKIE, nextPath, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/upstox',
      maxAge: 10 * 60,
    });
    return redirect;
  } catch {
    return NextResponse.redirect(new URL('/?upstox=connect_failed', origin));
  }
}
