import type { TradeOrder, TradeRecord } from '../../types/trading.ts';

export interface TradeOrderSyncPipelineResult {
  imported_orders: number;
  total_orders: number;
  total_trades: number;
  allOrders: TradeOrder[];
  allTrades: TradeRecord[];
}

interface RunTradeOrderSyncPipelineOptions {
  userId: string;
  newOrders: TradeOrder[];
  buildTrades?: (orders: TradeOrder[]) => Promise<TradeRecord[]> | TradeRecord[];
  dependencies?: {
    storeOrders: (orders: TradeOrder[], userId: string) => Promise<void>;
    retainLatestTradeMonths: (userId: string) => Promise<TradeOrder[]>;
    replaceTrades: (trades: TradeRecord[], userId: string) => Promise<void>;
  };
}

async function defaultDependencies(): Promise<Required<RunTradeOrderSyncPipelineOptions>['dependencies']> {
  const db = await import('../../db/supabase.ts');
  return {
    storeOrders: db.storeOrders,
    retainLatestTradeMonths: db.retainLatestTradeMonths,
    replaceTrades: db.replaceTrades,
  };
}

async function defaultBuildTrades(orders: TradeOrder[]) {
  const { matchTrades } = await import('../../engine/trade-matcher.ts');
  return matchTrades(orders);
}

export async function runTradeOrderSyncPipeline({
  userId,
  newOrders,
  buildTrades = defaultBuildTrades,
  dependencies,
}: RunTradeOrderSyncPipelineOptions): Promise<TradeOrderSyncPipelineResult> {
  const syncDependencies = dependencies || await defaultDependencies();

  await syncDependencies.storeOrders(newOrders, userId);

  const allOrders = await syncDependencies.retainLatestTradeMonths(userId);
  const allTrades = await buildTrades(allOrders);

  await syncDependencies.replaceTrades(allTrades, userId);

  return {
    imported_orders: newOrders.length,
    total_orders: allOrders.length,
    total_trades: allTrades.length,
    allOrders,
    allTrades,
  };
}
