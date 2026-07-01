import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { getZerodhaConfig, isZerodhaServerConfigured } from '@/lib/brokers/zerodha/config';
import { isTokenExpired, todayIstDate } from '@/lib/brokers/zerodha/session';
import { fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, maskApiKey } from '@/lib/db/broker-connections';
import { getErrorMessage } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const serverConfigured = isZerodhaServerConfigured(request.nextUrl.origin);
    const connection = serverConfigured ? await fetchBrokerConnection(user.id) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const connected = credentialsConfigured && Boolean(connection?.encrypted_access_token);
    const tokenExpired = connected ? isTokenExpired(connection?.token_expires_at) : true;
    const configured = serverConfigured && credentialsConfigured;
    const apiKey = credentialsConfigured ? getBrokerApiKey(connection) : '';

    return NextResponse.json({
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      configured,
      connected,
      needs_reconnect: configured && (!connected || tokenExpired),
      api_key_masked: maskApiKey(apiKey),
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      redirect_url: getZerodhaConfig(request.nextUrl.origin).redirectUrl,
      token_expires_at: connection?.token_expires_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      broker_user_id: connection?.broker_user_id || '',
      broker_user_name: connection?.broker_user_name || '',
      today: todayIstDate(),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
