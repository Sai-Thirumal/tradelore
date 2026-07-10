import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getBrokerAdapter,
  isKnownBrokerId,
  listBrokerAdapters,
  listBrokerOptions,
} from './registry.ts';
import { listBrokerCatalogEntriesByMarket } from './catalog.ts';
import { ANGELONE_BROKER, DELTA_BROKER, DHAN_BROKER, UPSTOX_BROKER, ZERODHA_BROKER } from './types.ts';
import { DeltaApiError } from '../crypto/delta/client.ts';
import { AngelOneApiError } from '../india/angelone/client.ts';
import { DhanApiError } from '../india/dhan/client.ts';
import { KiteApiError } from '../india/kite/client.ts';
import { UpstoxApiError } from '../india/upstox/client.ts';

test('registers formal broker adapters', () => {
  const kite = getBrokerAdapter(ZERODHA_BROKER);
  const dhan = getBrokerAdapter(DHAN_BROKER);
  const upstox = getBrokerAdapter(UPSTOX_BROKER);
  const angelone = getBrokerAdapter(ANGELONE_BROKER);
  const delta = getBrokerAdapter(DELTA_BROKER);

  assert.ok(kite);
  assert.ok(dhan);
  assert.ok(upstox);
  assert.ok(angelone);
  assert.ok(delta);
  assert.equal(kite.broker, ZERODHA_BROKER);
  assert.equal(kite.market, 'india');
  assert.equal(dhan.broker, DHAN_BROKER);
  assert.equal(dhan.market, 'india');
  assert.equal(upstox.broker, UPSTOX_BROKER);
  assert.equal(upstox.market, 'india');
  assert.equal(angelone.broker, ANGELONE_BROKER);
  assert.equal(angelone.market, 'india');
  assert.equal(delta.broker, DELTA_BROKER);
  assert.equal(delta.market, 'crypto');
  assert.equal(typeof kite.testConnection, 'function');
  assert.equal(typeof dhan.testConnection, 'function');
  assert.equal(typeof upstox.testConnection, 'function');
  assert.equal(typeof angelone.testConnection, 'function');
  assert.equal(typeof delta.testConnection, 'function');
  assert.equal(typeof kite.normalizeOrders, 'function');
  assert.equal(typeof dhan.normalizeOrders, 'function');
  assert.equal(typeof upstox.normalizeOrders, 'function');
  assert.equal(typeof angelone.normalizeOrders, 'function');
  assert.equal(typeof delta.normalizeOrders, 'function');
});

test('catalog can list brokers by market family', () => {
  assert.deepEqual(
    listBrokerCatalogEntriesByMarket('india').map((broker) => broker.id),
    [ZERODHA_BROKER, DHAN_BROKER, UPSTOX_BROKER, ANGELONE_BROKER],
  );
  assert.deepEqual(
    listBrokerCatalogEntriesByMarket('crypto').map((broker) => broker.id),
    [DELTA_BROKER],
  );
});

test('broker options expose stable UI metadata without server-only hooks', () => {
  assert.deepEqual(
    listBrokerOptions().map((broker) => ({
      id: broker.id,
      market: broker.market,
      supportsCsvImport: broker.supportsCsvImport,
    })),
    [
      { id: ZERODHA_BROKER, market: 'india', supportsCsvImport: true },
      { id: DHAN_BROKER, market: 'india', supportsCsvImport: false },
      { id: UPSTOX_BROKER, market: 'india', supportsCsvImport: false },
      { id: ANGELONE_BROKER, market: 'india', supportsCsvImport: false },
      { id: DELTA_BROKER, market: 'crypto', supportsCsvImport: true },
    ],
  );
});

test('known broker guard rejects future ids until an adapter is registered', () => {
  assert.equal(isKnownBrokerId(ZERODHA_BROKER), true);
  assert.equal(isKnownBrokerId(DHAN_BROKER), true);
  assert.equal(isKnownBrokerId(UPSTOX_BROKER), true);
  assert.equal(isKnownBrokerId(ANGELONE_BROKER), true);
  assert.equal(isKnownBrokerId(DELTA_BROKER), true);
  assert.equal(isKnownBrokerId('future-broker'), false);
  assert.equal(getBrokerAdapter('future-broker'), undefined);
  assert.equal(listBrokerAdapters().length, 5);
});

test('adapter sync errors map broker-specific retry responses', () => {
  const kite = getBrokerAdapter(ZERODHA_BROKER);
  const dhan = getBrokerAdapter(DHAN_BROKER);
  const upstox = getBrokerAdapter(UPSTOX_BROKER);
  const angelone = getBrokerAdapter(ANGELONE_BROKER);
  const delta = getBrokerAdapter(DELTA_BROKER);
  assert.ok(kite);
  assert.ok(dhan);
  assert.ok(upstox);
  assert.ok(angelone);
  assert.ok(delta);

  assert.deepEqual(
    kite.mapSyncError?.(new KiteApiError('expired', 403, 'TokenException')),
    {
      status: 409,
      body: { error: 'Zerodha session expired. Please reconnect Zerodha.', needs_reconnect: true },
    },
  );

  assert.deepEqual(
    dhan.mapSyncError?.(new DhanApiError('expired', 401, 'TokenException')),
    {
      status: 409,
      body: { error: 'Dhan session expired. Please reconnect Dhan.', needs_reconnect: true },
    },
  );

  assert.deepEqual(
    upstox.mapSyncError?.(new UpstoxApiError('expired', 401, 'TokenException')),
    {
      status: 409,
      body: { error: 'Upstox session expired. Please reconnect Upstox.', needs_reconnect: true },
    },
  );

  assert.deepEqual(
    angelone.mapSyncError?.(new AngelOneApiError('expired', 401, 'TokenException')),
    {
      status: 409,
      body: { error: 'Angel One JWT token expired. Save a fresh Angel One JWT token.', needs_reconnect: true },
    },
  );

  assert.deepEqual(
    delta.mapSyncError?.(new DeltaApiError('slow down', 429, 'rate_limit', '2026-07-09T10:00:00Z')),
    {
      status: 429,
      body: {
        error: 'Delta rate limit reached. Delta rate limit resets at 2026-07-09T10:00:00Z.',
        retry_after: '2026-07-09T10:00:00Z',
      },
    },
  );
});
