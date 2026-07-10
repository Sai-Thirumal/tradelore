import { runTradeOrderSyncPipeline } from '../../core/sync.ts';
import {
  UPSTOX_BROKER,
  fetchBrokerConnection,
  hasBrokerCredentials,
  updateBrokerSyncState,
} from '../../../db/broker-connections.ts';
import { decryptSecret } from '../../../security/encryption.ts';
import { UpstoxApiError, fetchUpstoxHistoricalTrades, type UpstoxHistoricalTrade } from './client.ts';
import { upstoxTradesToTradeOrders } from './normalize.ts';

const SEGMENTS = ['EQ', 'FO', 'COM', 'CD'] as const;
const PAGE_SIZE = 500;

export interface UpstoxSyncResult {
  imported_orders: number;
  imported_trades: number;
  total_orders: number;
  total_trades: number;
  synced_at: string;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function syncWindow(now = new Date()) {
  const start = new Date(now);
  // ponytail: app retains six broker months, so syncing more would fetch data we immediately discard.
  start.setMonth(start.getMonth() - 6);
  return { startDate: isoDate(start), endDate: isoDate(now) };
}

function upstoxSyncErrorMessage(error: unknown) {
  if (error instanceof UpstoxApiError && (error.statusCode === 401 || error.statusCode === 403)) {
    return 'Upstox session expired. Reconnect Upstox and sync again.';
  }
  return 'Upstox sync failed.';
}

async function fetchSegmentTrades(accessToken: string, segment: string, startDate: string, endDate: string) {
  const trades: UpstoxHistoricalTrade[] = [];
  for (let pageNumber = 1; ; pageNumber += 1) {
    const response = await fetchUpstoxHistoricalTrades({ accessToken, segment, startDate, endDate, pageNumber, pageSize: PAGE_SIZE });
    trades.push(...(response.data || []));
    const page = response.meta_data?.page;
    if (!page?.total_pages || pageNumber >= page.total_pages) return trades;
  }
}

export async function syncUpstoxTrades(userId: string): Promise<UpstoxSyncResult> {
  try {
    const connection = await fetchBrokerConnection(userId, UPSTOX_BROKER);
    if (!hasBrokerCredentials(connection) || !connection.encrypted_access_token) {
      throw new UpstoxApiError('Upstox connection is required before syncing.', 400, 'InputException');
    }

    const accessToken = decryptSecret(connection.encrypted_access_token);
    const { startDate, endDate } = syncWindow();
    const trades = (await Promise.all(SEGMENTS.map((segment) => fetchSegmentTrades(accessToken, segment, startDate, endDate)))).flat();
    const newOrders = upstoxTradesToTradeOrders(trades, connection.broker_user_id || userId);
    const { total_orders, total_trades } = await runTradeOrderSyncPipeline({ userId, newOrders });
    const syncedAt = new Date().toISOString();

    await updateBrokerSyncState(userId, {
      last_sync_at: syncedAt,
      last_sync_status: 'success',
      last_sync_error: '',
    }, UPSTOX_BROKER);

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
      last_sync_error: upstoxSyncErrorMessage(error),
    }, UPSTOX_BROKER).catch(() => {});
    throw error;
  }
}
