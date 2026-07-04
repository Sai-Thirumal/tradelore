import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { isDeltaServerConfigured } from '@/lib/brokers/delta/config';
import {
  DELTA_BROKER,
  fetchBrokerConnection,
  getBrokerApiKey,
  hasBrokerCredentials,
  maskApiKey,
} from '@/lib/db/broker-connections';
import { internalErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const serverConfigured = isDeltaServerConfigured();
    const connection = serverConfigured ? await fetchBrokerConnection(user.id, DELTA_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const syncStatus = (connection?.last_sync_status || '').trim().toLowerCase();
    const connected = credentialsConfigured
      && syncStatus !== ''
      && syncStatus !== 'credentials_saved'
      && syncStatus !== 'credentials_deleted'
      && syncStatus !== 'disconnected';

    return NextResponse.json({
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      connected,
      blocked_by_broker: '',
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      last_sync_cursor: connection?.last_sync_cursor || '',
    });
  } catch (error: unknown) {
    return internalErrorResponse(error, 'Unable to load Delta status.');
  }
}
