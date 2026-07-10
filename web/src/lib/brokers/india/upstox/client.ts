const UPSTOX_API_BASE = 'https://api.upstox.com/v2';
const UPSTOX_LOGIN_URL = `${UPSTOX_API_BASE}/login/authorization/dialog`;
const UPSTOX_TOKEN_URL = `${UPSTOX_API_BASE}/login/authorization/token`;

export interface UpstoxCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  redirectUrl?: string;
}

interface UpstoxErrorBody {
  errors?: Array<{ errorCode?: string; message?: string }>;
  message?: string;
}

export interface UpstoxTokenResponse {
  access_token: string;
  user_id?: string;
  user_name?: string;
  user_type?: string;
  email?: string;
}

export interface UpstoxHistoricalTrade {
  exchange?: string;
  segment?: string;
  option_type?: string;
  quantity?: number | string;
  amount?: number | string;
  trade_id?: string | number;
  trade_date?: string;
  transaction_type?: 'BUY' | 'SELL' | string;
  scrip_name?: string;
  strike_price?: string | number;
  expiry?: string;
  price?: number | string;
  isin?: string;
  symbol?: string;
  instrument_token?: string;
}

interface UpstoxListResponse<T> {
  status?: string;
  data?: T[];
  meta_data?: {
    page?: {
      page_number?: number;
      total_pages?: number;
    };
  };
}

export class UpstoxApiError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'UpstoxApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export function createUpstoxLoginUrl(apiKey: string, redirectUrl: string, state: string) {
  const url = new URL(UPSTOX_LOGIN_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', apiKey);
  url.searchParams.set('redirect_uri', redirectUrl);
  url.searchParams.set('state', state);
  return url;
}

async function parseUpstoxResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as UpstoxErrorBody | T | null;

  if (!response.ok) {
    const error = body as UpstoxErrorBody | null;
    const first = error?.errors?.[0];
    throw new UpstoxApiError(
      first?.message || error?.message || `Upstox request failed with status ${response.status}`,
      response.status,
      first?.errorCode,
    );
  }

  return body as T;
}

export async function exchangeUpstoxCode(code: string, credentials: UpstoxCredentials): Promise<UpstoxTokenResponse> {
  if (!credentials.apiKey || !credentials.apiSecret || !credentials.redirectUrl) {
    throw new UpstoxApiError('Upstox API credentials are not configured.', 401, 'InputException');
  }

  const form = new URLSearchParams({
    code,
    client_id: credentials.apiKey,
    client_secret: credentials.apiSecret,
    redirect_uri: credentials.redirectUrl,
    grant_type: 'authorization_code',
  });

  const response = await fetch(UPSTOX_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  return parseUpstoxResponse<UpstoxTokenResponse>(response);
}

async function upstoxGet<T>(accessToken: string, path: string, query?: URLSearchParams): Promise<T> {
  if (!accessToken) throw new UpstoxApiError('Upstox access token is required.', 401, 'TokenException');
  const url = `${UPSTOX_API_BASE}${path}${query?.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  return parseUpstoxResponse<T>(response);
}

export async function fetchUpstoxHistoricalTrades(params: {
  accessToken: string;
  segment: string;
  startDate: string;
  endDate: string;
  pageNumber: number;
  pageSize: number;
}) {
  const query = new URLSearchParams({
    segment: params.segment,
    start_date: params.startDate,
    end_date: params.endDate,
    page_number: String(params.pageNumber),
    page_size: String(params.pageSize),
  });
  return upstoxGet<UpstoxListResponse<UpstoxHistoricalTrade>>(params.accessToken, '/order/trades/get-historical-trades', query);
}
