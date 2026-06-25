import Papa from 'papaparse';
import { RequestValidationError } from './request';

export const MAX_CSV_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;
export const SUPPORTED_BROKERS = ['zerodha'] as const;

export type SupportedBroker = (typeof SUPPORTED_BROKERS)[number];

const HEADER_MAP: Record<string, string> = {
  symbol: 'symbol',
  scrip: 'symbol',
  stock: 'symbol',
  'trade time': 'trade_time',
  trade_time: 'trade_time',
  'order execution time': 'trade_time',
  order_execution_time: 'trade_time',
  date: 'trade_time',
  time: 'trade_time',
  trade_date: 'trade_date',
  'order id': 'order_id',
  order_id: 'order_id',
  orderid: 'order_id',
  'trade id': 'trade_id',
  trade_id: 'trade_id',
  tradeid: 'trade_id',
  type: 'type',
  'trade type': 'type',
  trade_type: 'type',
  'buy / sell': 'type',
  'buy/sell': 'type',
  side: 'type',
  qty: 'qty',
  quantity: 'qty',
  'qty.': 'qty',
  shares: 'qty',
  price: 'price',
  'trade price': 'price',
  'execution price': 'price',
  exchange: 'exchange',
  market: 'exchange',
  segment: 'segment',
  expiry_date: 'expiry_date',
  expiry: 'expiry_date',
  'price multiplier': 'price_multiplier',
  price_multiplier: 'price_multiplier',
  'contract multiplier': 'price_multiplier',
  contract_multiplier: 'price_multiplier',
};

const REQUIRED_FIELDS = ['symbol', 'type', 'qty', 'price'] as const;
const ZERODHA_REQUIRED_HEADERS = [
  'symbol',
  'trade_date',
  'trade_type',
  'quantity',
  'price',
  'trade_id',
  'order_id',
  'order_execution_time',
  'exchange',
] as const;

interface CsvPreview {
  data?: unknown[];
  meta?: {
    fields?: string[];
  };
  errors?: Papa.ParseError[];
}

export function parseSupportedBroker(rawBroker: FormDataEntryValue | null): SupportedBroker {
  if (rawBroker !== 'zerodha') {
    throw new RequestValidationError('Only Zerodha imports are supported');
  }
  return rawBroker;
}

export function validateCsvUpload(file: File, text: string, broker: SupportedBroker) {
  if (file.size > MAX_CSV_UPLOAD_BYTES) {
    throw new RequestValidationError('CSV file must be 10 MB or smaller', 413);
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  }) as CsvPreview;

  const rowCount = parsed.data?.length || 0;
  if (rowCount > MAX_CSV_ROWS) {
    throw new RequestValidationError(`CSV file must contain ${MAX_CSV_ROWS} rows or fewer`, 413);
  }

  const fields = parsed.meta?.fields || [];
  if (!fields.length || parsed.errors?.some(error => error.code === 'UndetectableDelimiter')) {
    throw new RequestValidationError('CSV header row is required');
  }

  const normalisedFields = new Set(fields.map(field => field.trim().toLowerCase()));

  if (broker === 'zerodha') {
    const missingZerodhaHeader = ZERODHA_REQUIRED_HEADERS.find(field => !normalisedFields.has(field));
    if (missingZerodhaHeader) {
      throw new RequestValidationError(`Zerodha CSV is missing required ${missingZerodhaHeader} column`);
    }
  }

  const mappedFields = new Set([...normalisedFields].map(field => HEADER_MAP[field] || field));
  const missing = REQUIRED_FIELDS.find(field => !mappedFields.has(field));
  if (missing) {
    throw new RequestValidationError(`CSV is missing required ${missing} column`);
  }

  if (!mappedFields.has('trade_time') && !mappedFields.has('trade_date')) {
    throw new RequestValidationError('CSV is missing required trade time or trade date column');
  }
}
