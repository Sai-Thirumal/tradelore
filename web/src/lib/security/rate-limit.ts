import { NextResponse, type NextRequest } from 'next/server';

interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const RATE_LIMIT_RULES: Array<{ method: string; pattern: RegExp; name: string; rule: RateLimitRule }> = [
  { method: 'POST', pattern: /^\/api\/auth\/signup$/, name: 'signup', rule: { limit: 5, windowMs: 60 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/import$/, name: 'import', rule: { limit: 20, windowMs: 60 * 60 * 1000 } },
  { method: 'DELETE', pattern: /^\/api\/clear$/, name: 'clear', rule: { limit: 3, windowMs: 60 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/broker\/(?:delta|zerodha|dhan|upstox|angelone)\/sync$/, name: 'broker-sync', rule: { limit: 10, windowMs: 10 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/broker\/(?:delta|zerodha|dhan|upstox|angelone)\/credentials$/, name: 'broker-credentials-save', rule: { limit: 10, windowMs: 60 * 60 * 1000 } },
  { method: 'DELETE', pattern: /^\/api\/broker\/(?:delta|zerodha|dhan|upstox|angelone)\/credentials$/, name: 'broker-credentials-delete', rule: { limit: 10, windowMs: 60 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/billing\/subscriptions$/, name: 'billing-subscribe', rule: { limit: 6, windowMs: 60 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/billing\/subscriptions\/verify$/, name: 'billing-verify', rule: { limit: 20, windowMs: 60 * 60 * 1000 } },
  { method: 'POST', pattern: /^\/api\/billing\/subscriptions\/cancel$/, name: 'billing-cancel', rule: { limit: 6, windowMs: 60 * 60 * 1000 } },
];

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwardedFor
    || 'unknown';
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function rateLimitHeaders(rule: RateLimitRule, bucket: RateLimitBucket) {
  const remaining = Math.max(0, rule.limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
  return {
    'RateLimit-Limit': String(rule.limit),
    'RateLimit-Remaining': String(remaining),
    'RateLimit-Reset': String(resetSeconds),
    'Retry-After': String(resetSeconds),
  };
}

function checkRateLimit(key: string, rule: RateLimitRule) {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + rule.windowMs };
    buckets.set(key, nextBucket);
    return { allowed: true, bucket: nextBucket };
  }

  bucket.count += 1;
  return { allowed: bucket.count <= rule.limit, bucket };
}

export function rateLimitRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const match = RATE_LIMIT_RULES.find(({ method: ruleMethod, pattern }) =>
    ruleMethod === method && pattern.test(pathname),
  );

  if (!match) return null;

  const ip = clientIp(request);
  const key = `${match.name}:${ip}`;
  const result = checkRateLimit(key, match.rule);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: rateLimitHeaders(match.rule, result.bucket) },
  );
}
