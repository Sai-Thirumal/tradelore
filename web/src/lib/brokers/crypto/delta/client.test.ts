import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { DeltaApiError, paginateDeltaFills, paginateDeltaWalletTransactions, parseDeltaResponse, signDeltaRequest } from './client.ts';

test('generates Delta HMAC SHA256 signatures', () => {
  const signature = signDeltaRequest({
    method: 'GET',
    timestamp: '1710000000',
    requestPath: '/v2/fills',
    apiSecret: 'secret',
  });

  assert.equal(
    signature,
    createHmac('sha256', 'secret').update('GET1710000000/v2/fills').digest('hex'),
  );
});

test('includes query string in Delta signatures', () => {
  const signature = signDeltaRequest({
    method: 'GET',
    timestamp: '1710000000',
    requestPath: '/v2/fills',
    queryString: '?product_id=27&page_size=100',
    apiSecret: 'secret',
  });

  assert.equal(
    signature,
    createHmac('sha256', 'secret').update('GET1710000000/v2/fills?product_id=27&page_size=100').digest('hex'),
  );
});

test('maps Delta auth and rate limit errors', async () => {
  const cases = [
    [401, { error: { code: 'invalid_api_key', message: 'Invalid API key' } }, 'invalid_api_key'],
    [401, { error: { code: 'unauthorized', message: 'Unauthorized access' } }, 'unauthorized'],
    [401, { error: { code: 'signature_mismatch', message: 'Signature mismatch' } }, 'signature_mismatch'],
    [401, { error: { code: 'expired_signature', message: 'Signature expired' } }, 'signature_expired'],
    [403, { error: { code: 'ip_forbidden', message: 'IP not whitelisted' } }, 'ip_not_whitelisted'],
    [429, { error: { code: 'rate_limit', message: 'Too many requests' } }, 'rate_limit'],
  ] as const;

  for (const [status, body, errorType] of cases) {
    const response = new Response(JSON.stringify(body), {
      status,
      headers: status === 429 ? { 'X-RATE-LIMIT-RESET': '1710000010' } : undefined,
    });

    await assert.rejects(
      () => parseDeltaResponse(response),
      (error: unknown) => {
        assert.ok(error instanceof DeltaApiError);
        assert.equal(error.errorType, errorType);
        if (status === 429) assert.equal(error.rateLimitReset, '1710000010');
        return true;
      },
    );
  }
});

test('paginates Delta fills with cursors', async () => {
  const seen: string[] = [];
  const result = await paginateDeltaFills(async (cursor) => {
    seen.push(cursor);
    if (!cursor) return { items: [{ id: 'fill-1' }], nextCursor: 'cursor-1' };
    return { items: [{ id: 'fill-2' }], nextCursor: '' };
  });

  assert.deepEqual(seen, ['', 'cursor-1']);
  assert.deepEqual(result.fills.map((fill) => fill.id), ['fill-1', 'fill-2']);
  assert.equal(result.cursor, 'cursor-1');
});

test('paginates Delta wallet transactions with cursors', async () => {
  const seen: string[] = [];
  const result = await paginateDeltaWalletTransactions(async (cursor) => {
    seen.push(cursor);
    if (!cursor) return { items: [{ id: 'tx-1', transaction_type: 'funding' }], nextCursor: 'cursor-1' };
    return { items: [{ id: 'tx-2', transaction_type: 'deposit' }], nextCursor: '' };
  });

  assert.deepEqual(seen, ['', 'cursor-1']);
  assert.deepEqual(result.map((transaction) => transaction.id), ['tx-1', 'tx-2']);
});
