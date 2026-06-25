import Papa from 'papaparse';
import { enrichMcxMetadata } from '../../engine/mcx.ts';
import type { CommodityClass, InstrumentType } from '@/lib/types/trading';

export type DerivativesExchange = 'NFO' | 'BFO' | 'MCX';

const KITE_INSTRUMENTS_BASE_URL = 'https://api.kite.trade/instruments';

interface KiteInstrumentCsvRow {
  instrument_token?: string;
  tradingsymbol?: string;
  name?: string;
  expiry?: string;
  strike?: string;
  lot_size?: string;
  instrument_type?: string;
  segment?: string;
  exchange?: string;
}

export interface BrokerInstrumentMetadata {
  instrumentToken: number;
  symbol: string;
  name: string;
  expiryDate: string;
  strike: number;
  lotSize: number;
  instrumentType: InstrumentType;
  segment: string;
  exchange: string;
  priceMultiplier: number;
  commodityClass: CommodityClass;
  metadataSource: string;
}

export interface BrokerInstrumentIndex {
  byToken: Map<number, BrokerInstrumentMetadata>;
  bySymbol: Map<string, BrokerInstrumentMetadata>;
}

export function parseInstrumentCsv(
  csv: string,
  expectedExchange: DerivativesExchange,
): BrokerInstrumentIndex {
  const parsed = Papa.parse<KiteInstrumentCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const byToken = new Map<number, BrokerInstrumentMetadata>();
  const bySymbol = new Map<string, BrokerInstrumentMetadata>();

  for (const row of parsed.data) {
    const symbol = (row.tradingsymbol || '').trim().toUpperCase();
    const token = Number(row.instrument_token || 0);
    const exchange = (row.exchange || '').trim().toUpperCase();
    if (!symbol || !token || exchange !== expectedExchange) continue;

    const instrumentType = (row.instrument_type || '') as InstrumentType;
    const normalizedType = ['EQ', 'FUT', 'CE', 'PE'].includes(instrumentType)
      ? instrumentType
      : '';
    const name = (row.name || '').replaceAll('"', '').trim().toUpperCase();
    const source = `kite-${expectedExchange.toLowerCase()}-instruments`;
    const inferred = expectedExchange === 'MCX'
      ? enrichMcxMetadata(symbol, {
          instrument_name: name,
          instrument_type: normalizedType,
          metadata_source: source,
        })
      : null;
    const metadata: BrokerInstrumentMetadata = {
      instrumentToken: token,
      symbol,
      name: inferred?.instrumentName || name,
      expiryDate: (row.expiry || '').trim(),
      strike: Number(row.strike || 0),
      lotSize: Number(row.lot_size || 1),
      instrumentType: inferred?.instrumentType || normalizedType,
      segment: (row.segment || expectedExchange).trim().toUpperCase(),
      exchange: expectedExchange,
      priceMultiplier: inferred?.priceMultiplier || 1,
      commodityClass: inferred?.commodityClass || '',
      metadataSource: inferred?.specificationSource || source,
    };

    byToken.set(token, metadata);
    bySymbol.set(symbol, metadata);
  }

  return { byToken, bySymbol };
}

export function parseMcxInstrumentCsv(csv: string): BrokerInstrumentIndex {
  return parseInstrumentCsv(csv, 'MCX');
}

export async function fetchInstrumentIndex(
  exchange: DerivativesExchange,
): Promise<BrokerInstrumentIndex> {
  const response = await fetch(`${KITE_INSTRUMENTS_BASE_URL}/${exchange}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'TradeLore/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Kite ${exchange} instrument master returned ${response.status}`);
  }
  return parseInstrumentCsv(await response.text(), exchange);
}

export function fetchMcxInstrumentIndex(): Promise<BrokerInstrumentIndex> {
  return fetchInstrumentIndex('MCX');
}
