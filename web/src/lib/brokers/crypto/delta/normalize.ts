import type { TradeOrder } from '@/lib/types/trading';
import type { DeltaFill } from './client';
import type { DeltaProductIndex, DeltaProductMetadata } from './products';

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function upper(value: unknown) {
  return text(value).toUpperCase();
}

function productId(value: DeltaFill) {
  const id = numberValue(value.product_id ?? value.id, 0);
  return id || undefined;
}

function productSymbol(value: DeltaFill) {
  return upper(value.product_symbol || value.symbol);
}

function segmentFromProduct(product: DeltaProductMetadata) {
  const contractType = upper(product?.contract_type);
  if (!contractType) return 'PERP';
  if (contractType.includes('CALL')) return 'CALL_OPTION';
  if (contractType.includes('PUT')) return 'PUT_OPTION';
  if (contractType.includes('FUT')) return contractType.includes('PERP') ? 'PERP' : 'FUTURES';
  return contractType;
}

function settlementAsset(fill: DeltaFill, product: DeltaProductMetadata) {
  return upper(fill.settling_asset_symbol || product.settling_asset);
}

export function deltaFillsToTradeOrders(fills: DeltaFill[], products: DeltaProductIndex): TradeOrder[] {
  return fills.flatMap((fill) => {
    const fillId = text(fill.fill_id || fill.id);
    const side = upper(fill.side);
    const symbol = productSymbol(fill);
    const qty = numberValue(fill.size);
    const price = numberValue(fill.price);
    if (!fillId || !symbol || qty <= 0 || price <= 0 || (side !== 'BUY' && side !== 'SELL')) return [];

    const id = productId(fill);
    const product = (id ? products.byId.get(id) : undefined) || products.bySymbol.get(symbol);
    if (!product) return [];
    const settlement = settlementAsset(fill, product);

    return [{
      uid: `delta:${symbol}:${fillId}`,
      broker: 'delta',
      exchange: 'DELTA',
      segment: segmentFromProduct(product),
      market_type: 'derivatives',
      symbol,
      product_id: id || product.product_id,
      product_symbol: symbol,
      contract_type: upper(product?.contract_type),
      notional_type: product.notional_type,
      base_asset: '',
      quote_asset: product.quoting_asset,
      settlement_asset: settlement,
      contract_value: product.contract_value,
      price_multiplier: product.contract_value,
      trade_time: text(fill.created_at).replace('T', ' ').split('.')[0],
      order_id: text(fill.order_id),
      trade_id: fillId,
      external_order_id: text(fill.order_id),
      external_trade_id: fillId,
      type: side as TradeOrder['type'],
      qty,
      price,
      fee_amount: numberValue(fill.commission),
      fee_asset: upper(fill.commission_asset_symbol || fill.commission_asset || settlement),
      liquidity_role: text(fill.role).toLowerCase(),
    }];
  });
}
