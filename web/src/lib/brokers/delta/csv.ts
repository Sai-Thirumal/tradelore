import Papa from 'papaparse';
import type { DeltaFill } from './client.ts';
import { deltaFillsToTradeOrders } from './normalize.ts';
import {
  buildDeltaProductIndex,
  normalizeDeltaProduct,
  type DeltaProductMetadata,
} from './products.ts';
import type { TradeOrder } from '../../types/trading.ts';

const HEADER_ALIASES: Record<string, string> = {
  id: 'id',
  'fill id': 'id',
  fill_id: 'id',
  'trade id': 'id',
  trade_id: 'id',
  side: 'side',
  size: 'size',
  qty: 'size',
  quantity: 'size',
  price: 'price',
  role: 'role',
  'liquidity role': 'role',
  liquidity_role: 'role',
  commission: 'commission',
  fee: 'commission',
  'fee amount': 'commission',
  fee_amount: 'commission',
  created_at: 'created_at',
  'created at': 'created_at',
  time: 'created_at',
  timestamp: 'created_at',
  product_id: 'product_id',
  'product id': 'product_id',
  product_symbol: 'product_symbol',
  'product symbol': 'product_symbol',
  symbol: 'product_symbol',
  order_id: 'order_id',
  'order id': 'order_id',
  settling_asset_symbol: 'settling_asset_symbol',
  'settling asset symbol': 'settling_asset_symbol',
  settlement_asset: 'settling_asset_symbol',
  'settlement asset': 'settling_asset_symbol',
  fee_asset: 'commission_asset_symbol',
  'fee asset': 'commission_asset_symbol',
  commission_asset_symbol: 'commission_asset_symbol',
  'commission asset symbol': 'commission_asset_symbol',
  contract_type: 'contract_type',
  'contract type': 'contract_type',
  notional_type: 'notional_type',
  'notional type': 'notional_type',
  contract_value: 'contract_value',
  'contract value': 'contract_value',
  quoting_asset: 'quoting_asset',
  'quoting asset': 'quoting_asset',
};

const REQUIRED_DELTA_HEADERS = ['id', 'side', 'size', 'price', 'created_at', 'product_symbol'] as const;

function normaliseHeader(header: string) {
  return HEADER_ALIASES[header.trim().toLowerCase()] || header.trim().toLowerCase();
}

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function num(value: unknown) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function upper(value: unknown) {
  return text(value).toUpperCase();
}

export function isDeltaCsvHeaders(fields: readonly string[]) {
  const mapped = new Set(fields.map(normaliseHeader));
  return REQUIRED_DELTA_HEADERS.every((header) => mapped.has(header));
}

function fallbackProduct(row: Record<string, string>): DeltaProductMetadata | null {
  const symbol = upper(row.product_symbol);
  const contractValue = num(row.contract_value);
  if (!symbol || contractValue <= 0) return null;
  return normalizeDeltaProduct({
    id: num(row.product_id) || undefined,
    symbol,
    contract_type: row.contract_type || 'PERPETUAL_FUTURES',
    notional_type: row.notional_type || 'VANILLA',
    contract_value: contractValue,
    settling_asset_symbol: row.settling_asset_symbol,
    quoting_asset: row.quoting_asset,
  });
}

export function parseDeltaCsv(textContent: string, cachedProducts: DeltaProductMetadata[] = []): TradeOrder[] {
  const parsed = Papa.parse<Record<string, string>>(textContent, { header: true, skipEmptyLines: true });
  const rows = parsed.data || [];
  const fallbackProducts = rows.flatMap((rawRow) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      row[normaliseHeader(key)] = value;
    }
    const product = fallbackProduct(row);
    return product ? [product] : [];
  });
  const productIndex = buildDeltaProductIndex([...cachedProducts, ...fallbackProducts]);
  const fills: DeltaFill[] = rows.map((rawRow) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      row[normaliseHeader(key)] = value;
    }
    return {
      id: row.id,
      side: row.side,
      size: row.size,
      price: row.price,
      role: row.role,
      commission: row.commission,
      created_at: row.created_at,
      product_id: row.product_id,
      product_symbol: row.product_symbol,
      order_id: row.order_id,
      settling_asset_symbol: row.settling_asset_symbol,
      commission_asset_symbol: row.commission_asset_symbol,
    };
  });

  const seen = new Set<string>();
  return deltaFillsToTradeOrders(fills, productIndex).filter((order) => {
    if (seen.has(order.uid)) return false;
    seen.add(order.uid);
    return true;
  });
}
