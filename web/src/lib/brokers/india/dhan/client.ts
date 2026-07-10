const DHAN_API_BASE = 'https://api.dhan.co/v2';

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
