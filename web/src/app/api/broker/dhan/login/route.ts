import { NextRequest, NextResponse } from 'next/server';
import { requireActiveEntitlement } from '@/lib/auth/session';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { createDhanConsent, createDhanLoginUrl } from '@/lib/brokers/india/dhan/client';
import { isDhanServerConfigured } from '@/lib/brokers/india/dhan/config';
import { DHAN_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials } from '@/lib/db/broker-connections';
import { decryptSecret } from '@/lib/security/encryption';

export const runtime = 'nodejs';

const NEXT_COOKIE = 'dhan_oauth_next';
const STARTED_COOKIE = 'dhan_oauth_started';

export async function GET(request: NextRequest) {
  const { user, response } = await requireActiveEntitlement();
  if (response) return response;

  const origin = request.nextUrl.origin;
  try {
    if (!isDhanServerConfigured()) {
      return NextResponse.redirect(new URL('/?dhan=not_configured', origin));
    }

    const connection = await fetchBrokerConnection(user.id, DHAN_BROKER);
    if (!hasBrokerCredentials(connection) || !connection.broker_user_id) {
      return NextResponse.redirect(new URL('/settings/dhan?dhan=credentials_required', origin));
    }

    const consent = await createDhanConsent({
      clientId: connection.broker_user_id,
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
    });
    const redirect = NextResponse.redirect(createDhanLoginUrl(consent.consentAppId));
    redirect.cookies.set(NEXT_COOKIE, getInternalRedirectPath(request.nextUrl.searchParams.get('next') || '/dashboard'), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/dhan',
      maxAge: 10 * 60,
    });
    redirect.cookies.set(STARTED_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/broker/dhan',
      maxAge: 10 * 60,
    });
    return redirect;
  } catch {
    return NextResponse.redirect(new URL('/?dhan=connect_failed', origin));
  }
}
