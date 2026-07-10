export const BROKER_MARKETS = ['india', 'crypto'] as const;
export type BrokerMarket = (typeof BROKER_MARKETS)[number];
export type BrokerMarketType = BrokerMarket;

export const KNOWN_BROKER_IDS = ['zerodha', 'dhan', 'upstox', 'angelone', 'delta'] as const;
export type KnownBrokerId = (typeof KNOWN_BROKER_IDS)[number];
export type BrokerId = KnownBrokerId | (string & {});
export const ZERODHA_BROKER = 'zerodha' satisfies KnownBrokerId;
export const DHAN_BROKER = 'dhan' satisfies KnownBrokerId;
export const UPSTOX_BROKER = 'upstox' satisfies KnownBrokerId;
export const ANGELONE_BROKER = 'angelone' satisfies KnownBrokerId;
export const DELTA_BROKER = 'delta' satisfies KnownBrokerId;

export interface BrokerRuntimeContext {
  origin?: string;
}

export type {
  BrokerAdapter,
  BrokerConnectionStatus,
  BrokerCredentialField,
  BrokerSyncErrorResponse,
  BrokerSyncResult,
  RawBrokerFill,
  RawBrokerOrder,
  RawFundingTransaction,
} from './adapter.ts';
