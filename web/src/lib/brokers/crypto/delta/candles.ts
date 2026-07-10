import { DELTA_INDIA_API_BASE } from './client.ts';

export interface DeltaCandle {
  time?: string | number;
  timestamp?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
}

interface DeltaCandlesResponse {
  result?: DeltaCandle[];
  candles?: DeltaCandle[];
}

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const RESOLUTIONS = [
  ['1m', 60],
  ['3m', 180],
  ['5m', 300],
  ['15m', 900],
  ['30m', 1800],
  ['1h', 3600],
  ['2h', 7200],
  ['4h', 14400],
  ['6h', 21600],
  ['1d', 86400],
  ['1w', 604800],
] as const;

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isDeltaChartExchange(exchange: string) {
  return exchange.trim().toUpperCase() === 'DELTA';
}

export function deltaDateTimeToUnix(value: string) {
  if (!value) return 0;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  return Math.floor(new Date(withZone).getTime() / 1000);
}

export function chooseDeltaResolution(rangeSeconds: number) {
  const range = Math.max(rangeSeconds, 60);
  return RESOLUTIONS.find(([, seconds]) => Math.ceil(range / seconds) <= 2000)?.[0] || '1w';
}

export function normalizeDeltaCandles(candles: DeltaCandle[]): ChartCandle[] {
  return candles
    .map((candle) => {
      const rawTime = candle.time ?? candle.timestamp;
      const time = typeof rawTime === 'string' && Number.isNaN(Number(rawTime))
        ? deltaDateTimeToUnix(rawTime)
        : num(rawTime) > 1_000_000_000_000
          ? Math.floor(num(rawTime) / 1000)
          : num(rawTime);
      return {
        time,
        open: num(candle.open),
        high: num(candle.high),
        low: num(candle.low),
        close: num(candle.close),
        volume: num(candle.volume),
      };
    })
    .filter((candle) => candle.time > 0 && candle.open > 0 && candle.close > 0)
    .sort((a, b) => a.time - b.time);
}

export async function fetchDeltaCandles(params: {
  symbol: string;
  resolution: string;
  start: number;
  end: number;
}) {
  const query = new URLSearchParams({
    symbol: params.symbol,
    resolution: params.resolution,
    start: String(params.start),
    end: String(params.end),
  });
  const response = await fetch(`${DELTA_INDIA_API_BASE}/v2/history/candles?${query.toString()}`, {
    headers: { 'User-Agent': 'TradeLore/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Delta returned ${response.status}`);
  const body = await response.json() as DeltaCandlesResponse | DeltaCandle[];
  return normalizeDeltaCandles(Array.isArray(body) ? body : body.result || body.candles || []);
}
