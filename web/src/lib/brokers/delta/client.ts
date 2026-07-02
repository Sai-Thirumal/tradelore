import { createHmac } from 'crypto';

export const DELTA_INDIA_API_BASE = 'https://api.india.delta.exchange';
const USER_AGENT = 'TradeLore/1.0';

export type DeltaHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface DeltaCredentials {
  apiKey: string;
  apiSecret: string;
}

export type DeltaErrorType =
  | 'invalid_api_key'
  | 'signature_expired'
  | 'signature_mismatch'
  | 'unauthorized'
  | 'ip_not_whitelisted'
  | 'rate_limit'
  | 'api_error';

interface DeltaErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
  success?: boolean;
}

interface DeltaListResponse<T> {
  result?: T[] | {
    data?: T[];
    fills?: T[];
    products?: T[];
    transactions?: T[];
    meta?: DeltaPageMeta;
  };
  data?: T[];
  fills?: T[];
  products?: T[];
  transactions?: T[];
  meta?: DeltaPageMeta;
  next_cursor?: string;
}

interface DeltaPageMeta {
  after?: string;
  next_cursor?: string;
}

export interface DeltaFill {
  id?: string | number;
  fill_id?: string | number;
  symbol?: string;
  side?: string;
  size?: string | number;
  price?: string | number;
  role?: string;
  commission?: string | number;
  created_at?: string;
  product_id?: string | number;
  product_symbol?: string;
  order_id?: string | number;
  settling_asset_symbol?: string;
  commission_asset?: string;
  commission_asset_symbol?: string;
  commission_details?: unknown;
  metadata?: {
    commission?: unknown;
    commission_details?: unknown;
  };
}

export interface DeltaProduct {
  id?: string | number;
  product_id?: string | number;
  symbol?: string;
  product_symbol?: string;
  contract_type?: string;
  notional_type?: string;
  contract_value?: string | number;
  contract_unit_currency?: string;
  expiry_time?: string;
  settlement_time?: string;
  settlement_method?: string;
  settlement_asset?: { symbol?: string };
  settling_asset?: { symbol?: string };
  settling_asset_symbol?: string;
  quoting_asset?: string | { symbol?: string };
  base_asset?: { symbol?: string };
  quote_asset?: { symbol?: string };
}

export interface DeltaWalletTransaction {
  id?: string | number;
  transaction_id?: string | number;
  type?: string;
  transaction_type?: string;
  amount?: string | number;
  balance_change?: string | number;
  asset_symbol?: string;
  currency?: string;
  product_id?: string | number;
  product_symbol?: string;
  symbol?: string;
  created_at?: string;
  timestamp?: string;
  meta_data?: unknown;
  metadata?: unknown;
}

export interface DeltaPage<T> {
  items: T[];
  nextCursor: string;
}

export class DeltaApiError extends Error {
  statusCode: number;
  errorType: DeltaErrorType;
  rateLimitReset?: string;

  constructor(message: string, statusCode: number, errorType: DeltaErrorType, rateLimitReset?: string) {
    super(message);
    this.name = 'DeltaApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.rateLimitReset = rateLimitReset;
  }
}

export function deltaTimestampSeconds(now = Date.now()) {
  return Math.floor(now / 1000).toString();
}

export function buildDeltaPrehash(
  method: DeltaHttpMethod,
  timestamp: string,
  requestPath: string,
  queryString = '',
  body = '',
) {
  return method.toUpperCase() + timestamp + requestPath + queryString + body;
}

export function signDeltaRequest(params: {
  method: DeltaHttpMethod;
  timestamp: string;
  requestPath: string;
  queryString?: string;
  body?: string;
  apiSecret: string;
}) {
  return createHmac('sha256', params.apiSecret)
    .update(buildDeltaPrehash(
      params.method,
      params.timestamp,
      params.requestPath,
      params.queryString || '',
      params.body || '',
    ))
    .digest('hex');
}

function mapDeltaError(status: number, code: string, message: string): DeltaErrorType {
  const text = `${code} ${message}`.toLowerCase();
  if (status === 429) return 'rate_limit';
  if (text.includes('ip') && (text.includes('whitelist') || text.includes('allowlist'))) return 'ip_not_whitelisted';
  if (text.includes('expired') || text.includes('timestamp')) return 'signature_expired';
  if (text.includes('signature') && (text.includes('mismatch') || text.includes('invalid'))) return 'signature_mismatch';
  if (text.includes('api key') || text.includes('apikey')) return 'invalid_api_key';
  if (status === 401 || status === 403 || text.includes('unauthorized')) return 'unauthorized';
  return 'api_error';
}

export async function parseDeltaResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as DeltaErrorBody | T | null;

  if (!response.ok) {
    const errorBody = body as DeltaErrorBody | null;
    const code = errorBody?.error?.code || errorBody?.code || '';
    const message = errorBody?.error?.message || errorBody?.message || `Delta request failed with status ${response.status}`;
    throw new DeltaApiError(
      message,
      response.status,
      mapDeltaError(response.status, code, message),
      response.headers.get('X-RATE-LIMIT-RESET') || response.headers.get('x-rate-limit-reset') || undefined,
    );
  }

  return body as T;
}

export async function deltaRequest<T>(
  credentials: DeltaCredentials,
  method: DeltaHttpMethod,
  requestPath: string,
  options: { query?: URLSearchParams; body?: unknown } = {},
): Promise<T> {
  if (!credentials.apiKey || !credentials.apiSecret) {
    throw new DeltaApiError('Delta API credentials are required.', 401, 'invalid_api_key');
  }

  const queryString = options.query?.toString() ? `?${options.query.toString()}` : '';
  const body = options.body === undefined ? '' : JSON.stringify(options.body);
  const timestamp = deltaTimestampSeconds();
  const signature = signDeltaRequest({
    method,
    timestamp,
    requestPath,
    queryString,
    body,
    apiSecret: credentials.apiSecret,
  });

  const response = await fetch(`${DELTA_INDIA_API_BASE}${requestPath}${queryString}`, {
    method,
    headers: {
      'api-key': credentials.apiKey,
      signature,
      timestamp,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    body: body || undefined,
    cache: 'no-store',
  });

  return parseDeltaResponse<T>(response);
}

function listItems<T>(response: DeltaListResponse<T>, key: 'fills' | 'products' | 'transactions'): T[] {
  if (Array.isArray(response.result)) return response.result;
  if (Array.isArray(response.result?.[key])) return response.result[key] as T[];
  if (Array.isArray(response.result?.data)) return response.result.data;
  if (Array.isArray(response[key])) return response[key] as T[];
  if (Array.isArray(response.data)) return response.data;
  return [];
}

function listCursor<T>(response: DeltaListResponse<T>) {
  return response.meta?.after
    || response.meta?.next_cursor
    || response.next_cursor
    || (Array.isArray(response.result) ? '' : response.result?.meta?.after || response.result?.meta?.next_cursor || '');
}

export async function fetchDeltaFillsPage(
  credentials: DeltaCredentials,
  cursor = '',
): Promise<DeltaPage<DeltaFill>> {
  const query = new URLSearchParams({ page_size: '100' });
  if (cursor) query.set('after', cursor);
  const response = await deltaRequest<DeltaListResponse<DeltaFill>>(credentials, 'GET', '/v2/fills', { query });
  return { items: listItems(response, 'fills'), nextCursor: listCursor(response) };
}

export async function paginateDeltaFills(
  fetchPage: (cursor: string) => Promise<DeltaPage<DeltaFill>>,
  startCursor = '',
) {
  const fills: DeltaFill[] = [];
  let cursor = startCursor;
  let nextCursor = '';
  for (let page = 0; page < 1000; page++) {
    const result = await fetchPage(cursor);
    fills.push(...result.items);
    nextCursor = result.nextCursor;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return { fills, cursor: nextCursor || cursor };
}

export async function fetchDeltaWalletTransactionsPage(
  credentials: DeltaCredentials,
  cursor = '',
): Promise<DeltaPage<DeltaWalletTransaction>> {
  const query = new URLSearchParams({ page_size: '100' });
  if (cursor) query.set('after', cursor);
  const response = await deltaRequest<DeltaListResponse<DeltaWalletTransaction>>(credentials, 'GET', '/v2/wallet/transactions', { query });
  return { items: listItems(response, 'transactions'), nextCursor: listCursor(response) };
}

export async function paginateDeltaWalletTransactions(
  fetchPage: (cursor: string) => Promise<DeltaPage<DeltaWalletTransaction>>,
) {
  const transactions: DeltaWalletTransaction[] = [];
  let cursor = '';
  for (let page = 0; page < 1000; page++) {
    const result = await fetchPage(cursor);
    transactions.push(...result.items);
    if (!result.nextCursor || result.nextCursor === cursor) break;
    cursor = result.nextCursor;
  }
  return transactions;
}

export async function fetchDeltaProducts(credentials: DeltaCredentials) {
  const response = await deltaRequest<DeltaListResponse<DeltaProduct>>(credentials, 'GET', '/v2/products');
  return listItems(response, 'products');
}

export async function fetchDeltaProduct(credentials: DeltaCredentials, symbol: string) {
  const response = await deltaRequest<{ result?: DeltaProduct } | DeltaProduct>(
    credentials,
    'GET',
    `/v2/products/${encodeURIComponent(symbol)}`,
  );
  return 'result' in response && response.result ? response.result : response as DeltaProduct;
}
