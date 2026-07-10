import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonRecord } from '@/lib/types/trading';
import type { DeltaCredentials, DeltaProduct } from './client.ts';
import { fetchDeltaProduct, fetchDeltaProducts } from './client.ts';

export interface DeltaProductMetadata {
  symbol: string;
  product_id?: number;
  contract_type: string;
  notional_type: string;
  contract_value: number;
  contract_unit_currency: string;
  quoting_asset: string;
  settling_asset: string;
  expiry_time: string;
  settlement_time: string;
  settlement_method: string;
  raw?: JsonRecord;
}

async function getSupabase(): Promise<SupabaseClient> {
  const { createServiceClient } = await import('../../../supabase/service.ts');
  return createServiceClient();
}

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function assetSymbol(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'symbol' in value) return text((value as { symbol?: unknown }).symbol);
  return '';
}

export function normalizeDeltaProduct(product: DeltaProduct): DeltaProductMetadata {
  const symbol = text(product.symbol || product.product_symbol).toUpperCase();
  return {
    symbol,
    product_id: numberValue(product.product_id || product.id) || undefined,
    contract_type: text(product.contract_type).toUpperCase(),
    notional_type: text(product.notional_type).toUpperCase(),
    contract_value: numberValue(product.contract_value, 1),
    contract_unit_currency: text(product.contract_unit_currency).toUpperCase(),
    quoting_asset: assetSymbol(product.quoting_asset || product.quote_asset).toUpperCase(),
    settling_asset: text(product.settling_asset_symbol || assetSymbol(product.settling_asset || product.settlement_asset)).toUpperCase(),
    expiry_time: text(product.expiry_time),
    settlement_time: text(product.settlement_time),
    settlement_method: text(product.settlement_method),
    raw: product as JsonRecord,
  };
}

export function buildDeltaProductIndex(products: DeltaProductMetadata[]) {
  const byId = new Map<number, DeltaProductMetadata>();
  const bySymbol = new Map<string, DeltaProductMetadata>();
  for (const product of products) {
    if (product.product_id) byId.set(product.product_id, product);
    if (product.symbol) bySymbol.set(product.symbol, product);
  }
  return { byId, bySymbol };
}

export type DeltaProductIndex = ReturnType<typeof buildDeltaProductIndex>;

export async function fetchCachedDeltaProducts(): Promise<DeltaProductMetadata[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('delta_products')
    .select('*')
    .order('symbol');
  if (error) throw error;
  return (data || []) as DeltaProductMetadata[];
}

export async function upsertDeltaProducts(products: DeltaProductMetadata[]) {
  if (!products.length) return;
  const supabase = await getSupabase();
  const rows = products.map((product) => ({ ...product, updated_at: new Date().toISOString() }));
  const { error } = await supabase
    .from('delta_products')
    .upsert(rows, { onConflict: 'symbol' });
  if (error) throw error;
}

export async function loadDeltaProductCache(credentials: DeltaCredentials) {
  const cached = await fetchCachedDeltaProducts().catch(() => []);
  if (cached.length) return buildDeltaProductIndex(cached);

  const products = (await fetchDeltaProducts(credentials))
    .map(normalizeDeltaProduct)
    .filter((product) => product.symbol);
  await upsertDeltaProducts(products).catch(() => {});
  return buildDeltaProductIndex(products);
}

export async function ensureDeltaProduct(credentials: DeltaCredentials, symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = (await fetchCachedDeltaProducts().catch(() => []))
    .find((product) => product.symbol === normalizedSymbol);
  if (cached) return cached;

  const product = normalizeDeltaProduct(await fetchDeltaProduct(credentials, normalizedSymbol));
  if (product.symbol) await upsertDeltaProducts([product]).catch(() => {});
  return product;
}
