export function matchTrades(orders: any[]): any[] {
  // Sort orders by trade_time
  const sortedOrders = [...orders].sort((a, b) => a.trade_time.localeCompare(b.trade_time));

  const bySymbol: Record<string, any[]> = {};
  for (const o of sortedOrders) {
    if (!bySymbol[o.symbol]) bySymbol[o.symbol] = [];
    bySymbol[o.symbol].push(o);
  }

  const trades: any[] = [];

  for (const [symbol, symOrders] of Object.entries(bySymbol)) {
    let netQty = 0;
    let direction: 'LONG' | 'SHORT' | null = null;
    let bucket: any[] = [];

    for (const order of symOrders) {
      const signed = order.type === 'BUY' ? Number(order.qty) : -Number(order.qty);

      if (netQty === 0) {
        direction = order.type === 'BUY' ? 'LONG' : 'SHORT';
        bucket = [order];
        netQty = signed;
      } else {
        bucket.push(order);
        netQty += signed;

        if (Math.abs(netQty) < 0.001) { // fully closed
          trades.push(buildTrade(symbol, direction as string, bucket));
          bucket = [];
          direction = null;
          netQty = 0;
        }
      }
    }
  }

  return trades.sort((a, b) => a.exit_time.localeCompare(b.exit_time));
}

function buildTrade(symbol: string, direction: string, orders: any[]) {
  const entryType = direction === 'LONG' ? 'BUY' : 'SELL';
  const exitType = direction === 'LONG' ? 'SELL' : 'BUY';

  const entries = orders.filter(o => o.type === entryType);
  const exits = orders.filter(o => o.type === exitType);

  const totalEntryQty = entries.reduce((sum, o) => sum + Number(o.qty), 0);
  const avgEntry = entries.reduce((sum, o) => sum + (Number(o.price) * Number(o.qty)), 0) / totalEntryQty;

  const totalExitQty = exits.reduce((sum, o) => sum + Number(o.qty), 0);
  const avgExit = exits.reduce((sum, o) => sum + (Number(o.price) * Number(o.qty)), 0) / totalExitQty;

  const qty = totalEntryQty;
  const pnl = direction === 'LONG' 
    ? (avgExit - avgEntry) * qty 
    : (avgEntry - avgExit) * qty;

  const result = pnl > 0.005 ? 'win' : pnl < -0.005 ? 'loss' : 'breakeven';

  const entryTime = orders[0].trade_time;
  const exitTime = orders[orders.length - 1].trade_time;
  const tradeDate = entryTime.substring(0, 10);

  return {
    symbol,
    exchange: orders[0].exchange || '',
    segment: orders[0].segment || '',
    expiry_date: orders[0].expiry_date || '',
    direction,
    qty,
    avg_entry: Number(avgEntry.toFixed(4)),
    avg_exit: Number(avgExit.toFixed(4)),
    pnl: Number(pnl.toFixed(2)),
    entry_time: entryTime,
    exit_time: exitTime,
    trade_date: tradeDate,
    result,
    orders
  };
}
