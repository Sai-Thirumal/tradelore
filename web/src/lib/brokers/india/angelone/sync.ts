import { ANGELONE_BROKER, fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, updateBrokerSyncState } from '../../../db/broker-connections.ts';
import { decryptSecret } from '../../../security/encryption.ts';
import { runTradeOrderSyncPipeline } from '../../core/sync.ts';
import { AngelOneApiError, fetchAngelOneTrades } from './client.ts';
import { angelOneTradesToTradeOrders } from './normalize.ts';

export interface AngelOneSyncResult {
  imported_orders: number;
  total_orders: number;
  total_trades: number;
  synced_at: string;
}

function angelOneSyncErrorMessage(error: unknown) {
  if (error instanceof AngelOneApiError && (error.statusCode === 401 || error.statusCode === 403)) {
    return 'Angel One JWT token expired. Save a fresh Angel One JWT token.';
  }
  return 'Angel One sync failed.';
}

export async function syncAngelOneTrades(userId: string): Promise<AngelOneSyncResult> {
  try {
    const connection = await fetchBrokerConnection(userId, ANGELONE_BROKER);
    if (!hasBrokerCredentials(connection)) {
      throw new AngelOneApiError('Angel One API key and JWT token are required before syncing.', 400, 'InputException');
    }

    const trades = await fetchAngelOneTrades({
      apiKey: getBrokerApiKey(connection),
      accessToken: decryptSecret(connection.encrypted_api_secret),
    });
    const newOrders = angelOneTradesToTradeOrders(trades, connection.broker_user_id || userId);
    const { total_orders, total_trades } = await runTradeOrderSyncPipeline({ userId, newOrders });
    const syncedAt = new Date().toISOString();

    await updateBrokerSyncState(userId, {
      last_sync_at: syncedAt,
      last_sync_status: 'success',
      last_sync_error: '',
    }, ANGELONE_BROKER);

    return {
      imported_orders: newOrders.length,
      total_orders,
      total_trades,
      synced_at: syncedAt,
    };
  } catch (error) {
    await updateBrokerSyncState(userId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: angelOneSyncErrorMessage(error),
    }, ANGELONE_BROKER).catch(() => {});
    throw error;
  }
}
