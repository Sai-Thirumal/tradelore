import { getZerodhaConfig, isZerodhaServerConfigured } from '../india/kite/config.ts';
import { isTokenExpired, todayIstDate } from '../india/kite/session.ts';
import { KiteApiError } from '../india/kite/client.ts';
import { syncZerodhaTrades } from '../india/kite/sync.ts';
import { kiteFillsToTradeOrders } from '../india/kite/normalize.ts';
import { getDhanConfig, isDhanServerConfigured } from '../india/dhan/config.ts';
import { DhanApiError, fetchDhanProfile } from '../india/dhan/client.ts';
import { syncDhanTrades } from '../india/dhan/sync.ts';
import { dhanTradesToTradeOrders } from '../india/dhan/normalize.ts';
import { getUpstoxConfig, isUpstoxServerConfigured } from '../india/upstox/config.ts';
import { UpstoxApiError } from '../india/upstox/client.ts';
import { syncUpstoxTrades } from '../india/upstox/sync.ts';
import { upstoxTradesToTradeOrders } from '../india/upstox/normalize.ts';
import { isAngelOneServerConfigured } from '../india/angelone/config.ts';
import { AngelOneApiError } from '../india/angelone/client.ts';
import { syncAngelOneTrades } from '../india/angelone/sync.ts';
import { angelOneTradesToTradeOrders } from '../india/angelone/normalize.ts';
import { isDeltaServerConfigured } from '../crypto/delta/config.ts';
import { DeltaApiError } from '../crypto/delta/client.ts';
import { syncDeltaFills } from '../crypto/delta/sync.ts';
import { deltaFillsToTradeOrders } from '../crypto/delta/normalize.ts';
import { buildDeltaProductIndex } from '../crypto/delta/products.ts';
import {
  fetchBrokerConnection,
  getBrokerApiKey,
  hasBrokerCredentials,
  maskApiKey,
} from '../../db/broker-connections.ts';
import { decryptSecret } from '../../security/encryption.ts';
import { BROKER_CATALOG, type BrokerCatalogEntry } from './catalog.ts';
import type { BrokerAdapter, BrokerId, BrokerRuntimeContext } from './types.ts';
import { ANGELONE_BROKER, DELTA_BROKER, DHAN_BROKER, KNOWN_BROKER_IDS, UPSTOX_BROKER, ZERODHA_BROKER, type KnownBrokerId } from './types.ts';

const API_KEY_SECRET_FIELDS = [
  { key: 'api_key', label: 'API key', maxChars: 200 },
  { key: 'api_secret', label: 'API secret', maxChars: 500 },
] as const;

const DHAN_CREDENTIAL_FIELDS = [
  { key: 'client_id', label: 'Client ID', maxChars: 50 },
  { key: 'api_key', label: 'API key', maxChars: 200 },
  { key: 'api_secret', label: 'API secret', maxChars: 500 },
] as const;

const ANGELONE_CREDENTIAL_FIELDS = [
  { key: 'api_key', label: 'API key', maxChars: 200 },
  { key: 'api_secret', label: 'JWT token', maxChars: 3000 },
] as const;

function catalogEntry(id: KnownBrokerId): BrokerCatalogEntry {
  const entry = BROKER_CATALOG.find((broker) => broker.id === id);
  if (!entry) throw new Error(`Missing broker catalog entry: ${id}`);
  return entry;
}

function isConnectedFromSyncStatus(status?: string | null) {
  const syncStatus = (status || '').trim().toLowerCase();
  return syncStatus !== ''
    && syncStatus !== 'credentials_saved'
    && syncStatus !== 'credentials_deleted'
    && syncStatus !== 'disconnected';
}

const zerodhaAdapter: BrokerAdapter<Awaited<ReturnType<typeof syncZerodhaTrades>>> = {
  ...catalogEntry(ZERODHA_BROKER),
  broker: ZERODHA_BROKER,
  credentialFields: API_KEY_SECRET_FIELDS,
  isServerConfigured: (context?: BrokerRuntimeContext) => isZerodhaServerConfigured(context?.origin),
  async getStatus(userId: string, context?: BrokerRuntimeContext) {
    const serverConfigured = isZerodhaServerConfigured(context?.origin);
    const connection = serverConfigured ? await fetchBrokerConnection(userId, ZERODHA_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const connected = credentialsConfigured && Boolean(connection?.encrypted_access_token);
    const tokenExpired = connected ? isTokenExpired(connection?.token_expires_at) : true;
    const configured = serverConfigured && credentialsConfigured;
    const apiKey = credentialsConfigured ? getBrokerApiKey(connection) : '';

    return {
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      configured,
      connected,
      needs_reconnect: configured && (!connected || tokenExpired),
      api_key_masked: maskApiKey(apiKey),
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      redirect_url: getZerodhaConfig(context?.origin).redirectUrl,
      token_expires_at: connection?.token_expires_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      broker_user_id: connection?.broker_user_id || '',
      broker_user_name: connection?.broker_user_name || '',
      today: todayIstDate(),
    };
  },
  testConnection(userId: string, context?: BrokerRuntimeContext) {
    return this.getStatus(userId, context);
  },
  normalizeOrders(input: unknown) {
    return kiteFillsToTradeOrders(input as Parameters<typeof kiteFillsToTradeOrders>[0], '', {});
  },
  sync: syncZerodhaTrades,
  mapSyncError(error: unknown) {
    if (error instanceof KiteApiError && error.errorType === 'TokenException') {
      return {
        status: 409,
        body: { error: 'Zerodha session expired. Please reconnect Zerodha.', needs_reconnect: true },
      };
    }
    return null;
  },
  isConnected: (connection) => Boolean(connection?.encrypted_access_token),
};

const dhanAdapter: BrokerAdapter<Awaited<ReturnType<typeof syncDhanTrades>>> = {
  ...catalogEntry(DHAN_BROKER),
  broker: DHAN_BROKER,
  credentialFields: DHAN_CREDENTIAL_FIELDS,
  isServerConfigured: () => isDhanServerConfigured(),
  async getStatus(userId: string, context?: BrokerRuntimeContext) {
    const serverConfigured = isDhanServerConfigured();
    const connection = serverConfigured ? await fetchBrokerConnection(userId, DHAN_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const connected = credentialsConfigured && Boolean(connection?.encrypted_access_token) && !isTokenExpired(connection?.token_expires_at);

    return {
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      configured: credentialsConfigured,
      connected,
      needs_reconnect: credentialsConfigured && !connected,
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      redirect_url: getDhanConfig(context?.origin).redirectUrl,
      token_expires_at: connection?.token_expires_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      broker_user_id: connection?.broker_user_id || '',
      broker_user_name: connection?.broker_user_name || '',
    };
  },
  async testConnection(userId: string) {
    const status = await this.getStatus(userId);
    const connection = await fetchBrokerConnection(userId, DHAN_BROKER);
    if (hasBrokerCredentials(connection) && connection.encrypted_access_token) {
      await fetchDhanProfile({
        clientId: connection.broker_user_id || '',
        accessToken: decryptSecret(connection.encrypted_access_token),
      });
    }
    return status;
  },
  normalizeOrders(input: unknown) {
    return dhanTradesToTradeOrders(input as Parameters<typeof dhanTradesToTradeOrders>[0]);
  },
  sync: syncDhanTrades,
  mapSyncError(error: unknown) {
    if (error instanceof DhanApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      return {
        status: 409,
        body: { error: 'Dhan session expired. Please reconnect Dhan.', needs_reconnect: true },
      };
    }
    return null;
  },
  isConnected: (connection) => hasBrokerCredentials(connection) && Boolean(connection.encrypted_access_token) && !isTokenExpired(connection.token_expires_at),
};

const upstoxAdapter: BrokerAdapter<Awaited<ReturnType<typeof syncUpstoxTrades>>> = {
  ...catalogEntry(UPSTOX_BROKER),
  broker: UPSTOX_BROKER,
  credentialFields: API_KEY_SECRET_FIELDS,
  isServerConfigured: (context?: BrokerRuntimeContext) => isUpstoxServerConfigured(context?.origin),
  async getStatus(userId: string, context?: BrokerRuntimeContext) {
    const serverConfigured = isUpstoxServerConfigured(context?.origin);
    const connection = serverConfigured ? await fetchBrokerConnection(userId, UPSTOX_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const connected = credentialsConfigured && Boolean(connection?.encrypted_access_token);

    return {
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      configured: credentialsConfigured,
      connected,
      needs_reconnect: credentialsConfigured && !connected,
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      redirect_url: getUpstoxConfig(context?.origin).redirectUrl,
      token_expires_at: connection?.token_expires_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      broker_user_id: connection?.broker_user_id || '',
      broker_user_name: connection?.broker_user_name || '',
    };
  },
  testConnection(userId: string, context?: BrokerRuntimeContext) {
    return this.getStatus(userId, context);
  },
  normalizeOrders(input: unknown) {
    return upstoxTradesToTradeOrders(input as Parameters<typeof upstoxTradesToTradeOrders>[0]);
  },
  sync: syncUpstoxTrades,
  mapSyncError(error: unknown) {
    if (error instanceof UpstoxApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      return {
        status: 409,
        body: { error: 'Upstox session expired. Please reconnect Upstox.', needs_reconnect: true },
      };
    }
    return null;
  },
  isConnected: (connection) => Boolean(connection?.encrypted_access_token),
};

const angelOneAdapter: BrokerAdapter<Awaited<ReturnType<typeof syncAngelOneTrades>>> = {
  ...catalogEntry(ANGELONE_BROKER),
  broker: ANGELONE_BROKER,
  credentialFields: ANGELONE_CREDENTIAL_FIELDS,
  isServerConfigured: () => isAngelOneServerConfigured(),
  async getStatus(userId: string) {
    const serverConfigured = isAngelOneServerConfigured();
    const connection = serverConfigured ? await fetchBrokerConnection(userId, ANGELONE_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);
    const connected = credentialsConfigured && isConnectedFromSyncStatus(connection?.last_sync_status);

    return {
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      configured: credentialsConfigured,
      connected,
      needs_reconnect: credentialsConfigured && !connected,
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      token_expires_at: connection?.token_expires_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      broker_user_id: connection?.broker_user_id || '',
      broker_user_name: connection?.broker_user_name || '',
    };
  },
  testConnection(userId: string) {
    return this.getStatus(userId);
  },
  normalizeOrders(input: unknown) {
    return angelOneTradesToTradeOrders(input as Parameters<typeof angelOneTradesToTradeOrders>[0]);
  },
  sync: syncAngelOneTrades,
  mapSyncError(error: unknown) {
    if (error instanceof AngelOneApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      return {
        status: 409,
        body: { error: 'Angel One JWT token expired. Save a fresh Angel One JWT token.', needs_reconnect: true },
      };
    }
    return null;
  },
  isConnected: (connection) => hasBrokerCredentials(connection) && isConnectedFromSyncStatus(connection.last_sync_status),
};

const deltaAdapter: BrokerAdapter<Awaited<ReturnType<typeof syncDeltaFills>>> = {
  ...catalogEntry(DELTA_BROKER),
  broker: DELTA_BROKER,
  credentialFields: API_KEY_SECRET_FIELDS,
  isServerConfigured: () => isDeltaServerConfigured(),
  async getStatus(userId: string) {
    const serverConfigured = isDeltaServerConfigured();
    const connection = serverConfigured ? await fetchBrokerConnection(userId, DELTA_BROKER) : null;
    const credentialsConfigured = serverConfigured && hasBrokerCredentials(connection);

    return {
      server_configured: serverConfigured,
      credentials_configured: credentialsConfigured,
      connected: credentialsConfigured && isConnectedFromSyncStatus(connection?.last_sync_status),
      api_key_masked: credentialsConfigured ? maskApiKey(getBrokerApiKey(connection)) : '',
      api_secret_saved: Boolean(connection?.encrypted_api_secret),
      credentials_saved_at: connection?.credentials_saved_at || null,
      last_sync_at: connection?.last_sync_at || null,
      last_sync_status: connection?.last_sync_status || '',
      last_sync_error: connection?.last_sync_error || '',
      last_sync_cursor: connection?.last_sync_cursor || '',
    };
  },
  testConnection(userId: string, context?: BrokerRuntimeContext) {
    return this.getStatus(userId, context);
  },
  normalizeOrders(input: unknown) {
    return deltaFillsToTradeOrders(input as Parameters<typeof deltaFillsToTradeOrders>[0], buildDeltaProductIndex([]));
  },
  sync: syncDeltaFills,
  mapSyncError(error: unknown) {
    if (!(error instanceof DeltaApiError)) return null;

    const retry = error.errorType === 'rate_limit'
      ? error.rateLimitReset
        ? ` Delta rate limit resets at ${error.rateLimitReset}.`
        : ' Please retry in a minute.'
      : '';

    if (error.statusCode !== 409 && error.errorType !== 'rate_limit') {
      return null;
    }

    return {
      status: error.statusCode === 409 ? 409 : error.errorType === 'rate_limit' ? 429 : 500,
      body: {
        error: error.errorType === 'rate_limit'
          ? `Delta rate limit reached.${retry}`
          : 'Delta sync is already running for this account.',
        retry_after: error.rateLimitReset,
      },
    };
  },
  isConnected: (connection) => hasBrokerCredentials(connection) && isConnectedFromSyncStatus(connection.last_sync_status),
};

const BROKER_ADAPTERS = {
  [ZERODHA_BROKER]: zerodhaAdapter,
  [DHAN_BROKER]: dhanAdapter,
  [UPSTOX_BROKER]: upstoxAdapter,
  [ANGELONE_BROKER]: angelOneAdapter,
  [DELTA_BROKER]: deltaAdapter,
} satisfies Record<KnownBrokerId, BrokerAdapter>;

export function isKnownBrokerId(value: string): value is KnownBrokerId {
  return (KNOWN_BROKER_IDS as readonly string[]).includes(value);
}

export function getBrokerAdapter(id: BrokerId): BrokerAdapter | undefined {
  return isKnownBrokerId(id) ? BROKER_ADAPTERS[id] : undefined;
}

export function requireBrokerAdapter(id: BrokerId): BrokerAdapter {
  const adapter = getBrokerAdapter(id);
  if (!adapter) {
    throw new Error(`Unsupported broker: ${id}`);
  }
  return adapter;
}

export function listBrokerAdapters() {
  return Object.values(BROKER_ADAPTERS);
}

export function listBrokerOptions() {
  return BROKER_CATALOG.map((adapter) => ({
    id: adapter.id,
    displayName: adapter.displayName,
    market: adapter.market,
    settingsPath: adapter.settingsPath,
    supportsOAuth: adapter.supportsOAuth,
    supportsCsvImport: adapter.supportsCsvImport,
  }));
}
