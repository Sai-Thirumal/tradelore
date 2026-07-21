import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { NextRequest } from 'next/server.js';
import { rateLimitRequest } from './rate-limit.ts';

test('falls back to local rate limit when shared storage is not configured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const request = {
      method: 'DELETE',
      nextUrl: new URL('https://app.test/api/clear'),
      headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }),
    } as NextRequest;

    assert.equal(await rateLimitRequest(request), null);
    assert.equal(await rateLimitRequest(request), null);
    assert.equal(await rateLimitRequest(request), null);
    assert.equal((await rateLimitRequest(request))?.status, 429);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test('shared rate limit RPC is locked down to service role', () => {
  const sql = readFileSync(new URL('../../../sql/10_rate_limits.sql', import.meta.url), 'utf8');
  assert.match(sql, /REVOKE ALL ON public\.rate_limit_buckets FROM anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.check_rate_limit\(text, integer, integer\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.check_rate_limit\(text, integer, integer\) TO service_role/);
});
