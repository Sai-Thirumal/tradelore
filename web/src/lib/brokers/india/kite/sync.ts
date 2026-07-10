import { fetchBrokerConnection, getBrokerApiKey, hasBrokerCredentials, updateBrokerSyncState } from '../../../db/broker-connections.ts';
import { runTradeOrderSyncPipeline } from '../../core/sync.ts';
import { decryptSecret } from '../../../security/encryption.ts';
import { KiteApiError, fetchKiteTrades } from './client.ts';
import { kiteFillsToTradeOrders } from './normalize.ts';
import { isTokenExpired } from './session.ts';
import { fetchInstrumentIndex, type DerivativesExchange } from './instruments.ts';

export interface ZerodhaSyncResult {
  imported_orders: number;
  total_orders: number;
  total_trades: number;
  raw_fills: number;
  fills_with_order_id: number;
  unique_order_ids: number;
  collapsed_fills: number;
  synced_at: string;
}

export async function syncZerodhaTrades(userId: string): Promise<ZerodhaSyncResult> {
  const connection = await fetchBrokerConnection(userId);

  if (!hasBrokerCredentials(connection)) {
    throw new KiteApiError('Zerodha API credentials are required before syncing.', 400, 'InputException');
  }

  if (!connection?.encrypted_access_token || isTokenExpired(connection.token_expires_at)) {
    throw new KiteApiError('Zerodha session expired. Reconnect to sync today.', 403, 'TokenException');
  }

  try {
    const accessToken = decryptSecret(connection.encrypted_access_token);
    const kiteUserId = connection.broker_user_id || userId;
    const fills = await fetchKiteTrades(getBrokerApiKey(connection), accessToken);
    const derivativesExchanges = [...new Set(
      fills
        .map((fill) => fill.exchange.toUpperCase())
        .filter((exchange): exchange is DerivativesExchange =>
          exchange === 'NFO' || exchange === 'BFO' || exchange === 'MCX'),
    )];
    const instrumentEntries = await Promise.all(
      derivativesExchanges.map(async (exchange) => [
        exchange,
        await fetchInstrumentIndex(exchange).catch(() => undefined),
      ] as const),
    );
    const instrumentIndexes = Object.fromEntries(
      instrumentEntries.filter((entry) => entry[1]),
    );
    const newOrders = kiteFillsToTradeOrders(fills, kiteUserId, instrumentIndexes);

    const { allOrders, total_orders, total_trades } = await runTradeOrderSyncPipeline({
      userId,
      newOrders,
    });

    const fillsWithOrderId = allOrders.filter(o => o.order_id).length;
    const uniqueOrderIds = new Set(allOrders.filter(o => o.order_id).map(o => o.order_id)).size;
    const syncedAt = new Date().toISOString();

    await updateBrokerSyncState(userId, {
      last_sync_at: syncedAt,
      last_sync_status: 'success',
      last_sync_error: '',
    });

    return {
      imported_orders: newOrders.length,
      total_orders,
      total_trades,
      raw_fills: allOrders.length,
      fills_with_order_id: fillsWithOrderId,
      unique_order_ids: uniqueOrderIds,
      collapsed_fills: uniqueOrderIds + allOrders.filter(o => !o.order_id).length,
      synced_at: syncedAt,
    };
  } catch (error) {
    await updateBrokerSyncState(userId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: 'Zerodha sync failed.',
    });
    throw error;
  }
}
