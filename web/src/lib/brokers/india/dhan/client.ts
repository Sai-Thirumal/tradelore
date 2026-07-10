const DHAN_API_BASE = 'https://api.dhan.co/v2';
const DHAN_AUTH_BASE = 'https://auth.dhan.co';

export interface DhanCredentials {
  clientId: string;
  accessToken: string;
}

interface DhanErrorBody {
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
}

export interface DhanProfile {
  dhanClientId: string;
  tokenValidity?: string;
  activeSegment?: string;
}

export interface DhanAppCredentials {
  clientId: string;
  apiKey: string;
  apiSecret: string;
}

export interface DhanConsent {
  consentAppId: string;
  consentAppStatus: string;
  status?: string;
}

export interface DhanAccessToken {
  dhanClientId: string;
  dhanClientName?: string;
  dhanClientUcc?: string;
  givenPowerOfAttorney?: boolean;
  accessToken: string;
  expiryTime: string;
}

export interface DhanTrade {
  dhanClientId?: string;
  orderId?: string;
  exchangeOrderId?: string;
  exchangeTradeId?: string;
  transactionType?: 'BUY' | 'SELL';
  exchangeSegment?: string;
  productType?: string;
  orderType?: string;
  tradingSymbol?: string;
  securityId?: string;
  tradedQuantity?: number | string;
  tradedPrice?: number | string;
  createTime?: string;
  updateTime?: string;
  exchangeTime?: string;
  drvExpiryDate?: string | null;
  drvOptionType?: string | null;
  drvStrikePrice?: number | string | null;
}

export class DhanApiError extends Error {
  statusCode: number;
  errorType?: string;

  constructor(message: string, statusCode: number, errorType?: string) {
    super(message);
    this.name = 'DhanApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

function normalizeDhanExpiry(expiryTime: string) {
  return /(?:Z|[+-]\d\d:\d\d)$/.test(expiryTime) ? expiryTime : `${expiryTime}+05:30`;
}

async function dhanAuthRequest<T>(url: URL, credentials: Pick<DhanAppCredentials, 'apiKey' | 'apiSecret'>, method = 'GET'): Promise<T> {
  if (!credentials.apiKey || !credentials.apiSecret) {
    throw new DhanApiError('Dhan API key and secret are required.', 401, 'TokenException');
  }

  const response = await fetch(url, {
    method,
    headers: {
      app_id: credentials.apiKey,
      app_secret: credentials.apiSecret,
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as DhanErrorBody | T | null;

  if (!response.ok) {
    const error = body as DhanErrorBody | null;
    throw new DhanApiError(
      error?.errorMessage || error?.message || `Dhan auth failed with status ${response.status}`,
      response.status,
      error?.errorType || error?.errorCode,
    );
  }

  return body as T;
}

async function dhanRequest<T>(credentials: DhanCredentials, path: string): Promise<T> {
  if (!credentials.clientId || !credentials.accessToken) {
    throw new DhanApiError('Dhan client ID and access token are required.', 401, 'TokenException');
  }

  const response = await fetch(`${DHAN_API_BASE}${path}`, {
    headers: {
      'access-token': credentials.accessToken,
      'client-id': credentials.clientId,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as DhanErrorBody | T | null;

  if (!response.ok) {
    const error = body as DhanErrorBody | null;
    throw new DhanApiError(
      error?.errorMessage || error?.message || `Dhan request failed with status ${response.status}`,
      response.status,
      error?.errorType || error?.errorCode,
    );
  }

  return body as T;
}

export function fetchDhanProfile(credentials: DhanCredentials) {
  return dhanRequest<DhanProfile>(credentials, '/profile');
}

export function fetchDhanTrades(credentials: DhanCredentials) {
  return dhanRequest<DhanTrade[]>(credentials, '/trades');
}

export function createDhanConsent(credentials: DhanAppCredentials) {
  const url = new URL('/app/generate-consent', DHAN_AUTH_BASE);
  url.searchParams.set('client_id', credentials.clientId);
  return dhanAuthRequest<DhanConsent>(url, credentials, 'POST');
}

export function createDhanLoginUrl(consentAppId: string) {
  return `${DHAN_AUTH_BASE}/login/consentApp-login?consentAppId=${encodeURIComponent(consentAppId)}`;
}

export async function consumeDhanConsent(tokenId: string, credentials: Pick<DhanAppCredentials, 'apiKey' | 'apiSecret'>) {
  const url = new URL('/app/consumeApp-consent', DHAN_AUTH_BASE);
  url.searchParams.set('tokenId', tokenId);
  const token = await dhanAuthRequest<DhanAccessToken>(url, credentials);
  return { ...token, expiryTime: normalizeDhanExpiry(token.expiryTime) };
}
