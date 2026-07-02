import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { isDeltaServerConfigured } from '@/lib/brokers/delta/config';
import {
  DELTA_BROKER,
  fetchBrokerConnection,
  fetchBrokerConnections,
  findOtherConfiguredBroker,
  getBrokerApiKey,
  hasBrokerCredentials,
  maskApiKey,
} from '@/lib/db/broker-connections';
import { getErrorMessage } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const serverConfigured = isDeltaServerConfigured();
    const [connection, connections] = serverConfigured
      ? await Promise.all([
          fetchBrokerConnection(user.id, DELTA_BROKER),
          fetchBrokerConnections(user.id),
        ])
      : [null, []];
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const otherBroker = findOtherConfiguredBroker(connections, DELTA_BROKER);

    return NextResponse.json({
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      connected: credentialsConfigured,
      blocked_by_broker: otherBroker,
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      last_sync_cursor: connection?.last_sync_cursor || '',
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
