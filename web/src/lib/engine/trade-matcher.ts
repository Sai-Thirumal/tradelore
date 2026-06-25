import { calculateTradeCommission } from './commission.ts';
import { enrichMcxMetadata, isMcxInstrument } from './mcx.ts';
import type { TradeDirection, TradeOrder, TradeRecord } from '@/lib/types/trading';

function buildPositionKey(order: TradeOrder) {
  return [
    order.symbol.trim().toUpperCase(),
    (order.exchange || '').trim().toUpperCase(),
    (order.segment || '').trim().toUpperCase(),
    (order.expiry_date || '').trim(),
  ].join('|||');
}

// Step 1 — Collapse partial fills by order_id
// Broker CSV has one row per exchange fill. A single order can be broken
// into multiple fills. Collapse them BEFORE position tracking.
function collapseFills(orders: TradeOrder[]): TradeOrder[] {
  const groups: Record<string, TradeOrder[]> = {};
  const orphans: TradeOrder[] = [];

  for (const o of orders) {
    const oid = o.order_id;
    if (oid) {
      if (!groups[oid]) groups[oid] = [];
      groups[oid].push(o);
    } else {
      orphans.push(o);
    }
  }

  const collapsed: TradeOrder[] = [];

  for (const [, fills] of Object.entries(groups)) {
    if (fills.length === 1) {
      collapsed.push(fills[0]);
      continue;
    }

    // Weighted average price: sum(qty * price) / sum(qty)
    const first = fills[0];
    let totalQty = 0;
    let weightedPriceSum = 0;

    for (const f of fills) {
      const q = Number(f.qty);
      const p = Number(f.price);
      totalQty += q;
      weightedPriceSum += q * p;
    }

    collapsed.push({
      ...first,
      qty: totalQty,
      price: Number((weightedPriceSum / totalQty).toFixed(4)),
      // keep trade_time from the first fill (order_execution_time)
    });
  }

  // Orphans (fills without order_id) pass through unchanged
  collapsed.push(...orphans);

  return collapsed;
}


// Step 2 — Position tracker on collapsed fills
// Group by symbol, sort by time, track running position across days.
// Emit complete trades when position returns to 0.
export function matchTrades(orders: TradeOrder[]): TradeRecord[] {
  // Step 1: Collapse partial fills
  const fills = collapseFills(orders);

  // Group by instrument identity so swing/delivery trades can span multiple sessions
  // without mixing different exchanges or contract types.
  const bySymbol: Record<string, TradeOrder[]> = {};
  for (const f of fills) {
    const key = buildPositionKey(f);
    if (!bySymbol[key]) bySymbol[key] = [];
    bySymbol[key].push(f);
  }

  const trades: TradeRecord[] = [];

  for (const [, group] of Object.entries(bySymbol)) {
    // Sort by trade_time ascending
    group.sort((a, b) => a.trade_time.localeCompare(b.trade_time));

    let netQty = 0;
    let direction: TradeDirection | null = null;
    let entryFills: TradeOrder[] = [];
    let exitFills: TradeOrder[] = [];

    for (const fill of group) {
      const signedQty = fill.type === 'BUY' ? Number(fill.qty) : -Number(fill.qty);

      if (netQty === 0) {
        // Opening fill
        direction = fill.type === 'BUY' ? 'LONG' : 'SHORT';
        entryFills = [fill];
        netQty = signedQty;
      } else {
        const sameDirection =
          (direction === 'LONG' && fill.type === 'BUY') ||
          (direction === 'SHORT' && fill.type === 'SELL');

        if (sameDirection) {
          entryFills.push(fill);
          netQty += signedQty;
          continue;
        }

        const openQty = Math.abs(netQty);
        const fillQty = Number(fill.qty);
        const closingQty = Math.min(openQty, fillQty);
        exitFills.push({ ...fill, qty: closingQty });
        netQty += direction === 'LONG' ? -closingQty : closingQty;

        if (Math.abs(netQty) < 0.001) {
          if (direction) {
            trades.push(buildTrade(fill.symbol, direction, entryFills, exitFills));
          }
          entryFills = [];
          exitFills = [];
          direction = null;
          netQty = 0;

          const reversalQty = fillQty - closingQty;
          if (reversalQty > 0.001) {
            const reversalFill = { ...fill, qty: reversalQty };
            direction = fill.type === 'BUY' ? 'LONG' : 'SHORT';
            entryFills = [reversalFill];
            netQty = fill.type === 'BUY' ? reversalQty : -reversalQty;
          }
        }
      }
    }

    // Position still open at end — do NOT emit as a completed trade.
  }

  return trades.sort((a, b) => a.exit_time.localeCompare(b.exit_time));
}


function buildTrade(
  symbol: string,
  direction: TradeDirection,
  entryFills: TradeOrder[],
  exitFills: TradeOrder[],
): TradeRecord {
  // Weighted average entry price
  const totalEntryQty = entryFills.reduce((s, f) => s + Number(f.qty), 0);
  const avgEntry =
    entryFills.reduce((s, f) => s + Number(f.price) * Number(f.qty), 0) /
    totalEntryQty;

  // Weighted average exit price
  const totalExitQty = exitFills.reduce((s, f) => s + Number(f.qty), 0);
  const avgExit =
    exitFills.reduce((s, f) => s + Number(f.price) * Number(f.qty), 0) /
    totalExitQty;

  const qty = totalEntryQty;
  const firstEntry = entryFills[0];
  const mcxMetadata = isMcxInstrument(firstEntry)
    ? enrichMcxMetadata(symbol, firstEntry)
    : null;
  const priceMultiplier = Number(mcxMetadata?.priceMultiplier || firstEntry.price_multiplier || 1);
  const pnl =
    direction === 'LONG'
      ? (avgExit - avgEntry) * qty * priceMultiplier
      : (avgEntry - avgExit) * qty * priceMultiplier;

  // entry_datetime = first entry fill timestamp
  // exit_datetime = last exit fill timestamp
  const entryTime = entryFills[0].trade_time;
  const exitTime = exitFills[exitFills.length - 1].trade_time;
  const tradeDate = exitTime.substring(0, 10);

  // All fills for the trade (both entry and exit, for detail view)
  const allOrders = [...entryFills, ...exitFills].sort((a, b) =>
    a.trade_time.localeCompare(b.trade_time),
  );

  // Calculate commission
  const commission = calculateTradeCommission({
    symbol,
    exchange: entryFills[0].exchange || '',
    segment: entryFills[0].segment || '',
    direction,
    qty,
    avg_entry: Number(avgEntry.toFixed(4)),
    avg_exit: Number(avgExit.toFixed(4)),
    entry_time: entryTime,
    exit_time: exitTime,
    orders: allOrders,
  });
  const netPnl = pnl - commission.total;
  const result = netPnl > 0.005 ? 'win' : netPnl < -0.005 ? 'loss' : 'breakeven';
  const calculationWarnings = [
    ...(mcxMetadata?.warnings || []),
    ...(commission.warnings || []),
  ].filter((warning, index, warnings) => warnings.indexOf(warning) === index);

  return {
    symbol,
    exchange: entryFills[0].exchange || '',
    segment: entryFills[0].segment || '',
    expiry_date: entryFills[0].expiry_date || '',
    instrument_name: entryFills[0].instrument_name || mcxMetadata?.instrumentName || '',
    instrument_type: entryFills[0].instrument_type || mcxMetadata?.instrumentType || '',
    strike: entryFills[0].strike || 0,
    lot_size: entryFills[0].lot_size || 1,
    price_multiplier: priceMultiplier,
    commodity_class: entryFills[0].commodity_class || mcxMetadata?.commodityClass || '',
    calculation_status: calculationWarnings.length ? 'estimated' : 'exact',
    calculation_warnings: calculationWarnings,
    direction,
    qty,
    avg_entry: Number(avgEntry.toFixed(4)),
    avg_exit: Number(avgExit.toFixed(4)),
    pnl: Number(pnl.toFixed(2)),
    commission: commission.total,
    commission_breakdown: commission,
    entry_time: entryTime,
    exit_time: exitTime,
    trade_date: tradeDate,
    result,
    orders: allOrders,
  };
}
