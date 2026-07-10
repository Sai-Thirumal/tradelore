import type { JsonRecord, TradeRecord } from '@/lib/types/trading';
import type { DeltaWalletTransaction } from './client';

export interface DeltaFundingTransaction {
  external_transaction_id: string;
  transaction_type: string;
  amount: number;
  asset: string;
  product_id?: number;
  product_symbol: string;
  occurred_at: string;
  raw: JsonRecord;
}

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function upper(value: unknown) {
  return text(value).toUpperCase();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object') return '';
  const value = (metadata as Record<string, unknown>)[key];
  return text(value);
}

function rawRecord(value: DeltaWalletTransaction): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

export function normalizeDeltaFundingTransactions(transactions: DeltaWalletTransaction[]): DeltaFundingTransaction[] {
  return transactions.flatMap((transaction) => {
    const type = text(transaction.transaction_type || transaction.type).toLowerCase();
    if (type !== 'funding') return [];

    const externalId = text(transaction.transaction_id || transaction.id);
    const amount = numberValue(transaction.amount ?? transaction.balance_change);
    const occurredAt = text(transaction.created_at || transaction.timestamp);
    const productSymbol = upper(transaction.product_symbol || transaction.symbol || metadataValue(transaction.metadata || transaction.meta_data, 'product_symbol'));
    const productId = numberValue(transaction.product_id || metadataValue(transaction.metadata || transaction.meta_data, 'product_id'));
    const asset = upper(transaction.asset_symbol || transaction.currency || metadataValue(transaction.metadata || transaction.meta_data, 'asset_symbol'));
    if (!externalId || !occurredAt || !asset || (!productSymbol && !productId)) return [];

    return [{
      external_transaction_id: externalId,
      transaction_type: type,
      amount,
      asset,
      product_id: productId || undefined,
      product_symbol: productSymbol,
      occurred_at: occurredAt,
      raw: rawRecord(transaction),
    }];
  });
}

function productKey(value: Pick<TradeRecord, 'product_id' | 'product_symbol' | 'symbol'> | DeltaFundingTransaction) {
  return value.product_id ? `id:${value.product_id}` : `sym:${upper(value.product_symbol || ('symbol' in value ? value.symbol : ''))}`;
}

function currencyKey(value: Pick<TradeRecord, 'pnl_currency' | 'settlement_asset'> | DeltaFundingTransaction) {
  return 'asset' in value ? upper(value.asset) : upper(value.pnl_currency || value.settlement_asset);
}

function fundingBucket(value: DeltaFundingTransaction) {
  return `${value.occurred_at.substring(0, 10)}|||${productKey(value)}|||${currencyKey(value)}`;
}

function tradeBucket(value: TradeRecord) {
  return `${(value.trade_date || value.exit_time || '').substring(0, 10)}|||${productKey(value)}|||${currencyKey(value)}`;
}

export function applyDeltaFundingToTrades(trades: TradeRecord[], funding: DeltaFundingTransaction[]): TradeRecord[] {
  const totals = new Map<string, number>();
  for (const tx of funding) {
    const key = fundingBucket(tx);
    totals.set(key, Number(((totals.get(key) || 0) + tx.amount).toFixed(8)));
  }
  if (!totals.size) return trades;

  const result = trades.map((trade) => ({ ...trade, funding: Number(trade.funding || 0) }));
  const latestTradeIndexByBucket = new Map<string, number>();
  result.forEach((trade, index) => {
    if ((trade.broker || '').toLowerCase() !== 'delta') return;
    const key = tradeBucket(trade);
    const existing = latestTradeIndexByBucket.get(key);
    if (existing === undefined || (trade.exit_time || '').localeCompare(result[existing].exit_time || '') >= 0) {
      latestTradeIndexByBucket.set(key, index);
    }
  });

  // ponytail: funding is bucket-level; assign once to the last same-day/product trade to avoid double-counting.
  for (const [key, amount] of totals) {
    const index = latestTradeIndexByBucket.get(key);
    if (index === undefined) continue;
    result[index].funding = Number((Number(result[index].funding || 0) + amount).toFixed(8));
  }
  return result;
}
