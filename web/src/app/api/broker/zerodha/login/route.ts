import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { createKiteLoginUrl } from '@/lib/brokers/zerodha/client';
import { isZerodhaServerConfigured } from '@/lib/brokers/zerodha/config';
import { fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials } from '@/lib/db/broker-connections';

export const runtime = 'nodejs';

const STATE_COOKIE = 'zerodha_oauth_state';

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuthUser();
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
    const loginUrl = createKiteLoginUrl(getBrokerApiKey(connection), state);

    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.set(STATE_COOKIE, state, {
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
