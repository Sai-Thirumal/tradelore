"""
CSV parser using pandas — handles large files and encoding variations.
Normalises broker-specific column names to a standard set.
"""

import pandas as pd
from io import StringIO

HEADER_MAP: dict[str, str] = {
    # symbol
    "symbol": "symbol", "scrip": "symbol", "stock": "symbol",
    # trade time — Kite uses order_execution_time
    "trade time": "trade_time", "trade_time": "trade_time",
    "order execution time": "trade_time", "order_execution_time": "trade_time",
    "date": "trade_time", "time": "trade_time", "trade_date": "trade_date",
    # order / trade IDs
    "order id": "order_id", "order_id": "order_id", "orderid": "order_id",
    "trade id": "trade_id", "trade_id": "trade_id", "tradeid": "trade_id",
    # order type — Kite uses trade_type with lowercase buy/sell
    "type": "type", "trade type": "type", "trade_type": "type",
    "buy / sell": "type", "buy/sell": "type", "side": "type",
    # quantity
    "qty": "qty", "quantity": "qty", "qty.": "qty", "shares": "qty",
    # price
    "price": "price", "trade price": "price", "execution price": "price",
    # exchange / segment
    "exchange": "exchange", "market": "exchange",
    "segment": "segment",
    "expiry_date": "expiry_date", "expiry": "expiry_date",
}

EXCHANGE_CODES: set[str] = {"NSE", "BSE", "NFO", "MCX", "BFO", "CDS", "NCD"}


def parse_csv(content: bytes) -> list[dict]:
    """Parse broker CSV bytes → list of normalised order dicts."""
    text = _decode(content)
    df   = _load_dataframe(text)
    return _extract_orders(df)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not decode CSV file — unsupported encoding")


def _load_dataframe(text: str) -> pd.DataFrame:
    df = pd.read_csv(StringIO(text), dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]

    # Map broker column names → standard names (first match wins)
    col_map: dict[str, str] = {}
    for col in df.columns:
        mapped = HEADER_MAP.get(col)
        if mapped and mapped not in col_map.values():
            col_map[col] = mapped

    return df.rename(columns=col_map)


def _normalise_datetime(raw: str) -> str:
    """Convert ISO-8601 with T separator to space-separated, strip sub-seconds."""
    return raw.replace("T", " ").split(".")[0]


def _extract_orders(df: pd.DataFrame) -> list[dict]:
    orders: list[dict] = []

    for i, row in df.iterrows():
        symbol = str(row.get("symbol", "")).strip()
        if not symbol:
            continue

        # Split exchange suffix from symbol (e.g. "TATAMOTORS NSE")
        exchange = str(row.get("exchange", "")).strip()
        parts = symbol.split()
        if len(parts) >= 2 and parts[-1].upper() in EXCHANGE_CODES:
            exchange = exchange or parts[-1].upper()
            symbol   = " ".join(parts[:-1])

        order_type = str(row.get("type", "")).upper().replace(" ", "")
        if order_type == "B":
            order_type = "BUY"
        if order_type == "S":
            order_type = "SELL"
        if order_type not in ("BUY", "SELL"):
            continue

        try:
            qty   = float(str(row.get("qty",   "0")).replace(",", ""))
            price = float(str(row.get("price", "0")).replace(",", ""))
        except ValueError:
            continue

        if qty <= 0 or price <= 0:
            continue

        trade_time_raw = str(row.get("trade_time", "")).strip()
        trade_date_raw = str(row.get("trade_date", "")).strip()

        # Kite: order_execution_time is the precise timestamp; trade_date is the date
        if trade_time_raw:
            trade_time = _normalise_datetime(trade_time_raw)
        elif trade_date_raw:
            trade_time = trade_date_raw + " 00:00:00"
        else:
            trade_time = ""

        order_id    = str(row.get("order_id",    "")).strip()
        trade_id    = str(row.get("trade_id",    "")).strip()
        segment     = str(row.get("segment",     "")).strip().upper()
        expiry_date = str(row.get("expiry_date", "")).strip()

        uid = (
            f"{order_id}_{trade_id}"
            if order_id and trade_id
            else f"{symbol}_{trade_time}_{order_type}_{qty}_{price}_{i}"
        )

        orders.append({
            "uid":         uid,
            "symbol":      symbol,
            "exchange":    exchange,
            "segment":     segment,
            "expiry_date": expiry_date,
            "trade_time":  trade_time,
            "order_id":    order_id,
            "trade_id":    trade_id,
            "type":        order_type,
            "qty":         qty,
            "price":       price,
        })

    return orders
