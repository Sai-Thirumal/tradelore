import { createHash } from 'crypto';

const KITE_API_BASE = 'https://api.kite.trade';
const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';
const KITE_SESSION_TOKEN_URL = `${KITE_API_BASE}/session/token`;
const KITE_TRADES_URL = `${KITE_API_BASE}/trades`;

export interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
}

interface KiteSuccess<T> {
  status: 'success';
  data: T;
}

interface KiteError {
  status: 'error';
  message?: string;
  error_type?: string;
}

export interface KiteTokenResponse {
  user_id: string;
  user_name?: string;
  user_shortname?: string;
  email?: string;
  broker?: string;
  api_key: string;
  access_token: string;
  login_time?: string;
}

export interface KiteTradeFill {
  trade_id: string;
  order_id: string;
  exchange: string;
  tradingsymbol: string;
  instrument_token?: number;
  product?: string;
  average_price: number;
  quantity: number;
  exchange_order_id?: string | null;
  transaction_type: 'BUY' | 'SELL';
  fill_timestamp: string;
  order_timestamp?: string;
  exchange_timestamp?: string;
}

export class KiteApiError extends Error {
  statusCode: number;
  errorType?: string;

  constructor(message: string, statusCode: number, errorType?: string) {
    super(message);
    this.name = 'KiteApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

function checksum(apiKey: string, requestToken: string, apiSecret: string) {
  return createHash('sha256').update(`${apiKey}${requestToken}${apiSecret}`).digest('hex');
}

export function createKiteLoginUrl(apiKey: string, state: string) {
  const loginUrl = new URL(KITE_LOGIN_URL);
  loginUrl.searchParams.set('v', '3');
  loginUrl.searchParams.set('api_key', apiKey);
  loginUrl.searchParams.set('redirect_params', new URLSearchParams({ state }).toString());
  return loginUrl;
}

async function parseKiteResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as KiteSuccess<T> | KiteError | null;

  if (!response.ok || !body || body.status !== 'success') {
    const message = body && 'message' in body && body.message
      ? body.message
      : `Kite request failed with status ${response.status}`;
    const errorType = body && 'error_type' in body ? body.error_type : undefined;
    throw new KiteApiError(message, response.status, errorType);
  }

  return body.data;
}

export async function exchangeRequestToken(requestToken: string, credentials: KiteCredentials): Promise<KiteTokenResponse> {
  const { apiKey, apiSecret } = credentials;
  if (!apiKey || !apiSecret) {
    throw new Error('Zerodha API credentials are not configured.');
  }

  const form = new URLSearchParams();
  form.set('api_key', apiKey);
  form.set('request_token', requestToken);
  form.set('checksum', checksum(apiKey, requestToken, apiSecret));

  const response = await fetch(KITE_SESSION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'X-Kite-Version': '3',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  return parseKiteResponse<KiteTokenResponse>(response);
}

export async function fetchKiteTrades(apiKey: string, accessToken: string): Promise<KiteTradeFill[]> {
  if (!apiKey) {
    throw new Error('Zerodha API key is not configured.');
  }

  const response = await fetch(KITE_TRADES_URL, {
    method: 'GET',
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${accessToken}`,
    },
    cache: 'no-store',
  });

  return parseKiteResponse<KiteTradeFill[]>(response);
}
