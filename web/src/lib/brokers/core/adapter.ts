import type { TradeOrder } from '@/lib/types/trading';
import type { BrokerConnectionRecord } from '@/lib/db/broker-connections';
import type { BrokerId, BrokerMarket, BrokerRuntimeContext } from './types';

export type RawBrokerOrder = unknown;
export type RawBrokerFill = unknown;
export type RawFundingTransaction = unknown;

export interface BrokerConnectionStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  connected: boolean;
  configured?: boolean;
  needs_reconnect?: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  token_expires_at?: string | null;
  redirect_url?: string;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  last_sync_cursor?: string;
  broker_user_id?: string;
  broker_user_name?: string;
  today?: string;
}

export interface BrokerCredentialField {
  key: 'client_id' | 'api_key' | 'api_secret';
  label: string;
  maxChars: number;
}

export interface BrokerSyncResult {
  imported_orders: number;
  total_orders: number;
  total_trades: number;
  synced_at: string;
}

export interface BrokerSyncErrorResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface BrokerAdapter<SyncResult extends BrokerSyncResult = BrokerSyncResult> {
  id: BrokerId;
  broker: BrokerId;
  displayName: string;
  market: BrokerMarket;
  settingsPath: string;
  credentialsPath: string;
  statusPath: string;
  disconnectPath: string;
  syncPath?: string;
  loginPath?: string;
  supportsOAuth: boolean;
  supportsCsvImport: boolean;
  credentialFields: readonly BrokerCredentialField[];
  connect?(userId: string, context?: BrokerRuntimeContext): Promise<void>;
  testConnection(userId: string, context?: BrokerRuntimeContext): Promise<BrokerConnectionStatus>;
  getStatus(userId: string, context?: BrokerRuntimeContext): Promise<BrokerConnectionStatus>;
  fetchOrders?(userId: string): Promise<RawBrokerOrder[]>;
  fetchFills?(userId: string): Promise<RawBrokerFill[]>;
  fetchFunding?(userId: string): Promise<RawFundingTransaction[]>;
  normalizeOrders(input: unknown): TradeOrder[];
  sync(userId: string): Promise<SyncResult>;
  isServerConfigured(context?: BrokerRuntimeContext): boolean;
  mapSyncError?(error: unknown): BrokerSyncErrorResponse | null;
  isConnected?(connection: BrokerConnectionRecord | null): boolean;
}
