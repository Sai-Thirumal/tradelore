import { NextResponse } from 'next/server';
import { getUnderlying, toYahooSymbol, istToUnix } from '@/lib/engine/symbols';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';

interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: number[];
      high?: number[];
      low?: number[];
      close?: number[];
      volume?: number[];
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
  };
}

export async function GET(request: Request) {
  const { response } = await requireAuthUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || '';
  const exchange = searchParams.get('exchange') || '';
  const fromStr = searchParams.get('from') || '';
  const toStr = searchParams.get('to') || '';

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const { underlying } = getUnderlying(symbol, exchange);
  const yahooSymbol = toYahooSymbol(underlying, exchange);
  if (!yahooSymbol) {
    return NextResponse.json({
      error: `Chart data is unavailable for ${underlying} on ${exchange || 'this exchange'}.`,
    }, { status: 404 });
  }

  // Convert IST times to Unix timestamps
  const entryUnix = fromStr ? istToUnix(fromStr) : 0;
  const exitUnix = toStr ? istToUnix(toStr) : 0;
  const durationSec = exitUnix - entryUnix;

  // Determine interval and padding
  const isIntraday = durationSec > 0 && durationSec <= 86400; // ≤1 day
  const interval = isIntraday ? '5m' : '1d';

  // Pad intraday charts tightly, but give swing trades a wider daily context.
  const padBeforeSec = 86400 * (isIntraday ? 5 : 30);
  const padAfterSec = 86400 * (isIntraday ? 5 : 10);
  const period1 = Math.floor(entryUnix - padBeforeSec);
  const period2 = Math.floor(Math.max(exitUnix, entryUnix + 86400) + padAfterSec);

  // Use period1/period2 for exact date range (range= is relative to "now")
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo returned ${res.status}` }, { status: 502 });
    }

    const json = await res.json() as YahooChartResponse;
    const result = json.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: 'No data for this symbol' }, { status: 404 });
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens: number[] = quote.open || [];
    const highs: number[] = quote.high || [];
    const lows: number[] = quote.low || [];
    const closes: number[] = quote.close || [];
    const volumes: number[] = quote.volume || [];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] == null || closes[i] == null) continue;
      candles.push({
        time: timestamps[i],
        open: opens[i],
        high: highs[i] || opens[i],
        low: lows[i] || opens[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }

    return NextResponse.json({
      underlying,
      yahooSymbol,
      exchange,
      referenceOnly: exchange.toUpperCase() === 'MCX',
      interval,
      candles,
      from: fromStr,
      to: toStr,
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
