import type { BrokerId, BrokerMarket } from './types.ts';
import { ANGELONE_BROKER, DELTA_BROKER, DHAN_BROKER, UPSTOX_BROKER, ZERODHA_BROKER } from './types.ts';

export interface BrokerCatalogEntry {
  id: BrokerId;
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
}

export const BROKER_CATALOG = [
  {
    id: ZERODHA_BROKER,
    displayName: 'Zerodha',
    market: 'india',
    settingsPath: '/settings/zerodha',
    credentialsPath: '/api/broker/zerodha/credentials',
    statusPath: '/api/broker/zerodha/status',
    disconnectPath: '/api/broker/zerodha/disconnect',
    syncPath: '/api/broker/zerodha/sync',
    loginPath: '/api/broker/zerodha/login',
    supportsOAuth: true,
    supportsCsvImport: true,
  },
  {
    id: DHAN_BROKER,
    displayName: 'Dhan',
    market: 'india',
    settingsPath: '/settings/dhan',
    credentialsPath: '/api/broker/dhan/credentials',
    statusPath: '/api/broker/dhan/status',
    disconnectPath: '/api/broker/dhan/disconnect',
    syncPath: '/api/broker/dhan/sync',
    loginPath: '/api/broker/dhan/login',
    supportsOAuth: true,
    supportsCsvImport: true,
  },
  {
    id: UPSTOX_BROKER,
    displayName: 'Upstox',
    market: 'india',
    settingsPath: '/settings/upstox',
    credentialsPath: '/api/broker/upstox/credentials',
    statusPath: '/api/broker/upstox/status',
    disconnectPath: '/api/broker/upstox/disconnect',
    syncPath: '/api/broker/upstox/sync',
    loginPath: '/api/broker/upstox/login',
    supportsOAuth: true,
    supportsCsvImport: true,
  },
  {
    id: ANGELONE_BROKER,
    displayName: 'Angel One',
    market: 'india',
    settingsPath: '/settings/angelone',
    credentialsPath: '/api/broker/angelone/credentials',
    statusPath: '/api/broker/angelone/status',
    disconnectPath: '/api/broker/angelone/disconnect',
    syncPath: '/api/broker/angelone/sync',
    supportsOAuth: false,
    supportsCsvImport: true,
  },
  {
    id: DELTA_BROKER,
    displayName: 'Delta Exchange',
    market: 'crypto',
    settingsPath: '/settings/delta',
    credentialsPath: '/api/broker/delta/credentials',
    statusPath: '/api/broker/delta/status',
    disconnectPath: '/api/broker/delta/disconnect',
    syncPath: '/api/broker/delta/sync',
    supportsOAuth: false,
    supportsCsvImport: true,
  },
] as const satisfies readonly BrokerCatalogEntry[];

export function listBrokerCatalogEntries() {
  return [...BROKER_CATALOG];
}

export function listBrokerCatalogEntriesByMarket(market: BrokerMarket) {
  return BROKER_CATALOG.filter((broker) => broker.market === market);
}
