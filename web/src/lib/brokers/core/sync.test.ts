import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TradeOrder, TradeRecord } from '@/lib/types/trading';
import { runTradeOrderSyncPipeline } from './sync.ts';

const calls: string[] = [];
let retainedOrders: TradeOrder[] = [];
let storedOrders: TradeOrder[] = [];
let replacedTrades: TradeRecord[] = [];

function order(uid: string, type: 'BUY' | 'SELL'): TradeOrder {
  return {
    uid,
    broker: 'test',
    symbol: 'NIFTY',
    trade_time: '2026-07-09T09:15:00+05:30',
    type,
    qty: 1,
    price: type === 'BUY' ? 100 : 110,
  };
}

test.beforeEach(() => {
  calls.length = 0;
  storedOrders = [];
  replacedTrades = [];
  retainedOrders = [order('1', 'BUY'), order('2', 'SELL')];
});

test('runs the common broker sync storage and matching pipeline', async () => {
  const matchedTrade: TradeRecord = {
    broker: 'test',
    symbol: 'NIFTY',
    direction: 'LONG',
    qty: 1,
    avg_entry: 100,
    avg_exit: 110,
    pnl: 10,
    entry_time: retainedOrders[0].trade_time,
    exit_time: retainedOrders[1].trade_time,
    trade_date: '2026-07-09',
    result: 'win',
    orders: retainedOrders,
  };

  const result = await runTradeOrderSyncPipeline({
    userId: 'user-1',
    newOrders: [order('new', 'BUY')],
    buildTrades(orders) {
      assert.equal(orders, retainedOrders);
      return [matchedTrade];
    },
    dependencies: {
      async storeOrders(orders: TradeOrder[], userId: string) {
        calls.push(`store:${userId}:${orders.length}`);
        storedOrders = orders;
      },
      async retainLatestTradeMonths(userId: string) {
        calls.push(`retain:${userId}`);
        return retainedOrders;
      },
      async replaceTrades(trades: TradeRecord[], userId: string) {
        calls.push(`replace:${userId}:${trades.length}`);
        replacedTrades = trades;
      },
    },
  });

  assert.deepEqual(calls, ['store:user-1:1', 'retain:user-1', 'replace:user-1:1']);
  assert.equal(storedOrders[0].uid, 'new');
  assert.deepEqual(replacedTrades, [matchedTrade]);
  assert.equal(result.imported_orders, 1);
  assert.equal(result.total_orders, 2);
  assert.equal(result.total_trades, 1);
});
