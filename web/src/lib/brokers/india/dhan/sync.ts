import { runTradeOrderSyncPipeline } from '../../core/sync.ts';
import {
  DHAN_BROKER,
  fetchBrokerConnection,
  getBrokerApiKey,
  hasBrokerCredentials,
  updateBrokerSyncState,
} from '../../../db/broker-connections.ts';
import { decryptSecret } from '../../../security/encryption.ts';
import { DhanApiError, fetchDhanTrades } from './client.ts';
import { dhanTradesToTradeOrders } from './normalize.ts';

export interface DhanSyncResult {
  imported_orders: number;
  imported_trades: number;
  total_orders: number;
  total_trades: number;
  synced_at: string;
}

function dhanSyncErrorMessage(error: unknown) {
  if (error instanceof DhanApiError && (error.statusCode === 401 || error.statusCode === 403)) {
    return 'Dhan access token expired or was rejected. Generate a new token and save it.';
  }
  return 'Dhan sync failed.';
}

export async function syncDhanTrades(userId: string): Promise<DhanSyncResult> {
  try {
    const connection = await fetchBrokerConnection(userId, DHAN_BROKER);
    if (!hasBrokerCredentials(connection)) {
      throw new DhanApiError('Dhan credentials are required before syncing.', 400, 'InputException');
    }

    const trades = await fetchDhanTrades({
      clientId: getBrokerApiKey(connection),
      accessToken: decryptSecret(connection.encrypted_api_secret || ''),
    });
    const newOrders = dhanTradesToTradeOrders(trades);
    const { total_orders, total_trades } = await runTradeOrderSyncPipeline({ userId, newOrders });
    const syncedAt = new Date().toISOString();

    await updateBrokerSyncState(userId, {
      last_sync_at: syncedAt,
      last_sync_status: 'success',
      last_sync_error: '',
    }, DHAN_BROKER);

    return {
      imported_orders: newOrders.length,
      imported_trades: trades.length,
      total_orders,
      total_trades,
      synced_at: syncedAt,
    };
  } catch (error) {
    await updateBrokerSyncState(userId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: dhanSyncErrorMessage(error),
    }, DHAN_BROKER).catch(() => {});
    throw error;
  }
}
