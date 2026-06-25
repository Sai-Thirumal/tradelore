// Extract the underlying asset from an option/futures symbol.
// NIFTY26N1423950CE → NIFTY
// BANKNIFTY25JAN45000PE → BANKNIFTY
// RELIANCE25JAN2800CE → RELIANCE
// WIPRO26APRFUT → WIPRO

const INDEX_PATTERNS: { regex: RegExp; underlying: string; exchange: string }[] = [
  { regex: /^(BANKNIFTY|BANK NIFTY)/i, underlying: 'BANKNIFTY', exchange: 'NSE' },
  { regex: /^(NIFTY|NIFTY50|NIFTY 50)/i, underlying: 'NIFTY', exchange: 'NSE' },
  { regex: /^(FINNIFTY|FIN NIFTY)/i, underlying: 'FINNIFTY', exchange: 'NSE' },
  { regex: /^(MIDCPNIFTY|MIDCP NIFTY)/i, underlying: 'MIDCPNIFTY', exchange: 'NSE' },
  { regex: /^(SENSEX|BSE)/i, underlying: 'SENSEX', exchange: 'BSE' },
];

// Matches NSE F&O symbols: SYMBOL+YY+MON+STRIKE|FUT(+CE|PE optionally)
// RELIANCE26APR2800CE → RELIANCE
// WIPRO26APRFUT → WIPRO
const FO_SYMBOL_RE = /^([A-Z]+)\d{2}[A-Z]{3}(\d+|FUT)/i;

export function getUnderlying(symbol: string, exchange = ''): { underlying: string; exchange: string } {
  const clean = symbol.trim().toUpperCase();
  if (exchange.toUpperCase() === 'MCX') {
    return { underlying: extractMcxInstrumentName(clean), exchange: 'MCX' };
  }

  // Try index patterns first
  for (const p of INDEX_PATTERNS) {
    if (p.regex.test(clean)) {
      return { underlying: p.underlying, exchange: p.exchange };
    }
  }

  // Match F&O symbols (options + futures)
  const foMatch = clean.match(FO_SYMBOL_RE);
  if (foMatch) {
    return { underlying: foMatch[1], exchange: 'NSE' };
  }

  // Fallback: return as-is
  return { underlying: clean, exchange: 'NSE' };
}

// Convert underlying to Yahoo Finance symbol
export function toYahooSymbol(underlying: string, exchange = ''): string | null {
  const u = underlying.toUpperCase();
  if (exchange.toUpperCase() === 'MCX') return getMcxYahooSymbol(u);
  // NSE indices
  if (u === 'NIFTY' || u === 'NIFTY50') return '^NSEI';
  if (u === 'BANKNIFTY') return '^NSEBANK';
  if (u === 'FINNIFTY') return '^CNXFINANCE';
  if (u === 'MIDCPNIFTY') return '^NSEMDCP50';
  // BSE
  if (u === 'SENSEX') return '^BSESN';
  // Stocks default to .NS suffix
  return `${u}.NS`;
}

// Convert IST datetime string to Unix timestamp (seconds).
// CSV timestamps are in IST (e.g., "2025-02-01 14:07:00").
// We add +05:30 offset so the resulting Unix timestamp aligns with Yahoo's UTC timestamps.
export function istToUnix(istStr: string): number {
  // Replace space with T and append IST offset
  const iso = istStr.replace(' ', 'T') + '+05:30';
  return new Date(iso).getTime() / 1000;
}
import { extractMcxInstrumentName, getMcxYahooSymbol } from './mcx';
