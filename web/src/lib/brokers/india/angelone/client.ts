const ANGELONE_API_BASE = 'https://apiconnect.angelone.in';

export interface AngelOneCredentials {
  apiKey: string;
  accessToken: string;
}

interface AngelOneResponse<T> {
  status?: boolean;
  message?: string;
  errorcode?: string;
  errorCode?: string;
  data?: T;
}

export interface AngelOneTrade {
  orderid?: string | number;
  order_id?: string | number;
  uniqueorderid?: string | number;
  fillid?: string | number;
  tradeid?: string | number;
  exchange?: string;
  tradingsymbol?: string;
  symbolname?: string;
  symboltoken?: string | number;
  transactiontype?: string;
  fillsize?: string | number;
  quantity?: string | number;
  fillprice?: string | number;
  price?: string | number;
  filltime?: string;
  updatetime?: string;
  exchorderupdatetime?: string;
  producttype?: string;
  instrumenttype?: string;
  optiontype?: string;
  expirydate?: string;
  strikeprice?: string | number;
}

export class AngelOneApiError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'AngelOneApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function angelOneGet<T>(credentials: AngelOneCredentials, path: string): Promise<T> {
  if (!credentials.apiKey || !credentials.accessToken) {
    throw new AngelOneApiError('Angel One API key and JWT token are required.', 401, 'TokenException');
  }

  const response = await fetch(`${ANGELONE_API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-PrivateKey': credentials.apiKey,
      Authorization: `Bearer ${credentials.accessToken}`,
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as AngelOneResponse<T> | null;

  if (!response.ok || !body || body.status === false) {
    throw new AngelOneApiError(
      body?.message || `Angel One request failed with status ${response.status}`,
      response.status,
      body?.errorCode || body?.errorcode,
    );
  }

  return (body.data ?? []) as T;
}

export function fetchAngelOneTrades(credentials: AngelOneCredentials) {
  return angelOneGet<AngelOneTrade[]>(credentials, '/rest/secure/angelbroking/order/v1/getTradeBook');
}
