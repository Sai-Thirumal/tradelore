import { runTradeOrderSyncPipeline } from '../../core/sync.ts';
import {
  DELTA_BROKER,
  fetchBrokerConnection,
  getBrokerApiKey,
  hasBrokerCredentials,
  updateBrokerSyncState,
} from '../../../db/broker-connections.ts';
import { fetchDeltaFundingTransactions, storeDeltaFundingTransactions } from '../../../db/supabase.ts';
import { matchTrades } from '../../../engine/trade-matcher.ts';
import { decryptSecret } from '../../../security/encryption.ts';
import { DeltaApiError, fetchDeltaFillsPage, fetchDeltaWalletTransactionsPage, paginateDeltaFills, paginateDeltaWalletTransactions } from './client.ts';
import { applyDeltaFundingToTrades, normalizeDeltaFundingTransactions } from './funding.ts';
import { deltaFillsToTradeOrders } from './normalize.ts';
import { loadDeltaProductCache } from './products.ts';

// ponytail: process-local lock; use a DB advisory lock if multi-instance sync races matter.
const activeSyncs = new Set<string>();

export interface DeltaSyncResult {
  imported_orders: number;
  imported_fills: number;
  total_orders: number;
  total_trades: number;
  imported_funding_transactions: number;
  cursor: string;
  synced_at: string;
}

function deltaSyncErrorMessage(error: unknown) {
  if (error instanceof DeltaApiError && error.errorType === 'rate_limit') {
    return error.rateLimitReset
      ? `Delta rate limit reached. Retry after ${error.rateLimitReset}.`
      : 'Delta rate limit reached. Please retry in a minute.';
  }
  if (error instanceof DeltaApiError && error.statusCode === 409) {
    return 'Delta sync is already running for this account.';
  }
  if (error instanceof DeltaApiError && error.errorType === 'invalid_api_key') {
    return 'Delta API credentials need attention.';
  }
  return 'Delta sync failed.';
}

async function fetchFundingTransactions(credentials: { apiKey: string; apiSecret: string }) {
  try {
    return normalizeDeltaFundingTransactions(
      await paginateDeltaWalletTransactions((pageCursor) => fetchDeltaWalletTransactionsPage(credentials, pageCursor)),
    );
  } catch (error) {
    if (error instanceof DeltaApiError && error.errorType === 'rate_limit') throw error;
    // ponytail: wallet transactions are v1.5 enrichment; keep fills sync alive if the endpoint is unavailable.
    return [];
  }
}

export async function syncDeltaFills(userId: string): Promise<DeltaSyncResult> {
  if (activeSyncs.has(userId)) {
    throw new DeltaApiError('Delta sync is already running for this account.', 409, 'api_error');
  }

  activeSyncs.add(userId);
  try {
    const connection = await fetchBrokerConnection(userId, DELTA_BROKER);
    if (!hasBrokerCredentials(connection)) {
      throw new DeltaApiError('Delta API credentials are required before syncing.', 400, 'invalid_api_key');
    }

    const credentials = {
      apiKey: getBrokerApiKey(connection),
      apiSecret: decryptSecret(connection.encrypted_api_secret || ''),
    };
    const products = await loadDeltaProductCache(credentials);
    const { fills, cursor } = await paginateDeltaFills(
      (pageCursor) => fetchDeltaFillsPage(credentials, pageCursor),
      connection.last_sync_cursor || '',
    );
    const fundingTransactions = await fetchFundingTransactions(credentials);
    const newOrders = deltaFillsToTradeOrders(fills, products);

    await storeDeltaFundingTransactions(fundingTransactions, userId);

    const { total_orders, total_trades } = await runTradeOrderSyncPipeline({
      userId,
      newOrders,
      async buildTrades(allOrders) {
        const allFunding = await fetchDeltaFundingTransactions(userId);
        return applyDeltaFundingToTrades(matchTrades(allOrders), allFunding);
      },
    });

    const syncedAt = new Date().toISOString();
    await updateBrokerSyncState(userId, {
      last_sync_at: syncedAt,
      last_sync_status: 'success',
      last_sync_error: '',
      last_sync_cursor: cursor,
    }, DELTA_BROKER);

    return {
      imported_orders: newOrders.length,
      imported_fills: fills.length,
      imported_funding_transactions: fundingTransactions.length,
      total_orders,
      total_trades,
      cursor,
      synced_at: syncedAt,
    };
  } catch (error) {
    const message = deltaSyncErrorMessage(error);
    await updateBrokerSyncState(userId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: message.slice(0, 500),
    }, DELTA_BROKER).catch(() => {});
    throw error;
  } finally {
    activeSyncs.delete(userId);
  }
}
