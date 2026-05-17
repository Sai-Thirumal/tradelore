"""
FIFO trade matching.

One "trade" = a position that opens (net qty goes 0 → N) and fully closes
(net qty returns to 0). Handles partial exits and pyramiding correctly.

All stats are realized P&L only — open positions are ignored.
"""

from datetime import date as date_type


def match_trades(orders: list[dict]) -> list[dict]:
    """Match a flat list of orders into completed trades using FIFO per symbol."""
    sorted_orders = sorted(orders, key=lambda o: o["trade_time"])

    by_symbol: dict[str, list[dict]] = {}
    for o in sorted_orders:
        by_symbol.setdefault(o["symbol"], []).append(o)

    trades: list[dict] = []

    for symbol, sym_orders in by_symbol.items():
        net_qty:   float        = 0.0
        direction: str | None   = None
        bucket:    list[dict]   = []

        for order in sym_orders:
            signed = order["qty"] if order["type"] == "BUY" else -order["qty"]

            if net_qty == 0:
                direction = "LONG" if order["type"] == "BUY" else "SHORT"
                bucket    = [order]
                net_qty   = signed
            else:
                bucket.append(order)
                net_qty += signed

                if abs(net_qty) < 0.001:          # position fully closed
                    trades.append(_build_trade(symbol, direction, bucket))
                    bucket    = []
                    direction = None
                    net_qty   = 0.0
        # Remaining open positions are unrealized — skip

    return sorted(trades, key=lambda t: t["exit_time"])


def _build_trade(symbol: str, direction: str, orders: list[dict]) -> dict:
    entry_type = "BUY"  if direction == "LONG" else "SELL"
    exit_type  = "SELL" if direction == "LONG" else "BUY"

    entries = [o for o in orders if o["type"] == entry_type]
    exits   = [o for o in orders if o["type"] == exit_type]

    total_entry_qty = sum(o["qty"] for o in entries)
    avg_entry       = sum(o["price"] * o["qty"] for o in entries) / total_entry_qty

    total_exit_qty  = sum(o["qty"] for o in exits)
    avg_exit        = sum(o["price"] * o["qty"] for o in exits) / total_exit_qty

    qty = total_entry_qty
    pnl = (
        (avg_exit - avg_entry) * qty
        if direction == "LONG"
        else (avg_entry - avg_exit) * qty
    )

    result = "win" if pnl > 0.005 else "loss" if pnl < -0.005 else "breakeven"

    entry_time = orders[0]["trade_time"]
    exit_time  = orders[-1]["trade_time"]
    trade_date = entry_time[:10]           # "YYYY-MM-DD"

    return {
        "symbol":      symbol,
        "exchange":    orders[0].get("exchange", ""),
        "segment":     orders[0].get("segment", ""),
        "expiry_date": orders[0].get("expiry_date", ""),
        "direction":   direction,
        "qty":         qty,
        "avg_entry":   round(avg_entry, 4),
        "avg_exit":    round(avg_exit,  4),
        "pnl":         round(pnl,       2),
        "entry_time":  entry_time,
        "exit_time":   exit_time,
        "trade_date":  trade_date,
        "result":      result,
        "orders":      orders,
    }
