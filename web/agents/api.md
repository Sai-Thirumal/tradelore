# TradeLore — API Reference

## Route Tree

```
/api/
├── chart/            GET   — Fetch OHLC candles for underlying asset
├── clear/            DELETE — Wipe all trade data
├── daily-journal/    GET|POST — Pre-market plan by date
├── import/           POST  — Upload broker CSV, parse → match → store
├── playbooks/        GET|POST|PUT|DELETE — Trading strategy setups CRUD
│   └── stats/        GET   — Computed win rate & avg R:R per playbook from tagged trades
├── trade-journal/    GET|POST — Per-trade post-market analysis
└── trades/           GET   — All completed trades
```

---

## Routes

### GET /api/trades
Returns all completed trades from Supabase. Paginated (no 1000-row cap).

**Response:** `Trade[]`
```json
[{
  "symbol": "NIFTY2520623400PE", "exchange": "NSE",
  "direction": "LONG", "qty": 75,
  "avg_entry": 115.5, "avg_exit": 113.85,
  "pnl": -123.75, "result": "loss",
  "entry_time": "2025-02-01 14:07:00", "exit_time": "2025-02-01 14:07:00",
  "trade_date": "2025-02-01", "segment": "FO",
  "orders": [{ "trade_time": "...", "type": "BUY", "qty": 75, "price": 115.5, "order_id": "..." }]
}]
```

### POST /api/import
Upload a broker CSV file. Full pipeline: parse → store orders → fetch all orders → match trades → replace trades.

**Request:** `multipart/form-data` with `file` field (CSV)
**Response:**
```json
{
  "imported_orders": 250, "total_orders": 2285, "total_trades": 408,
  "raw_fills": 2285, "fills_with_order_id": 2150, "unique_order_ids": 1800,
  "collapsed_fills": 1890
}
```
- `raw_fills`: total rows in DB
- `fills_with_order_id`: rows that have an `order_id`
- `unique_order_ids`: distinct order IDs (partial fills merged into one)
- `collapsed_fills`: unique IDs + fills without order_id (fills after collapse, before matching)

### DELETE /api/clear
Removes all trade_orders and trades from Supabase. **Irreversible.**

### GET /api/chart
Fetches OHLC candle data for the underlying asset of a trade symbol.

**Params:**
- `symbol` — trade symbol (e.g., `NIFTY2520623400PE`)
- `from` — entry datetime (e.g., `2025-02-01 14:07:00`)
- `to` — exit datetime

**Behavior:**
- Extracts underlying (NIFTY → `^NSEI` on Yahoo Finance)
- Trade ≤ 1 day → 5-min candles, 5-day range
- Trade > 1 day → daily candles, 3-month range

**Response:**
```json
{
  "underlying": "NIFTY", "yahooSymbol": "^NSEI",
  "interval": "5m", "candles": [
    { "time": 1779248700, "open": 23457.25, "high": 23467.10, "low": 23403.75, "close": 23460.65 }
  ]
}
```

### GET /api/daily-journal
Get pre-market plan for a specific date.

**Params:** `date` (YYYY-MM-DD, defaults to today)
**Response:** `DailyJournal | null`

### POST /api/daily-journal
Save or update pre-market plan. Upserts on `date`.

**Body:**
```json
{ "date": "2025-02-01", "market_outlook": "...", "outlook_bias": "Bullish",
  "capital_to_deploy": 50000, "key_levels": "...", "news_events": "..." }
```

### GET /api/playbooks
List all trading playbooks, or get a single one by ID.

**Params:** `id` (optional UUID — returns single playbook if provided)
**Response:** `Playbook[] | Playbook`
```json
[{ "id": "uuid", "name": "Opening Range Breakout", "data": { ... }, "is_default": true, "created_at": "...", "updated_at": "..." }]
```

On preview deploys without Supabase env vars, gracefully returns `[]`.

### POST /api/playbooks
Create a new playbook.

**Body:** `{ "name": "My Setup", "data": { "markets": ["Stocks"], ... } }`
**Response:** Created playbook (201)

### PUT /api/playbooks
Update an existing playbook.

**Body:** `{ "id": "uuid", "name": "New Name", "data": { ... } }`
Only `id` is required. Pass `name` and/or `data` to update those fields individually.
**Response:** Updated playbook

### DELETE /api/playbooks
Delete a playbook.

**Params:** `id` (required UUID)
**Response:** `{ "success": true }`

### GET /api/playbooks/stats
Returns computed performance stats for each playbook based on trades tagged with it in the journal.

**Response:** `Record<string, PlaybookStats>`
```json
{
  "playbook-uuid": {
    "total_trades": 12, "wins": 7, "losses": 5,
    "win_rate": 58, "avg_rr": 1.8,
    "total_pnl": 12500, "max_consecutive_losses": 3
  }
}
```
- `win_rate`: 0–100 integer
- `avg_rr`: actual P&L / risk_amount average
- `max_consecutive_losses`: longest losing streak
- Only returns playbooks that have at least one tagged trade

### GET /api/trade-journal
Get journal entry for a specific trade.

**Params:** `trade_id` (required)
**Response:** `TradeJournal | null`

### POST /api/trade-journal
Save or update per-trade journal. Upserts on `trade_id`.

**Body:**
```json
{ "trade_id": "NIFTY2520623400PE_2025-02-01 14:07:00",
  "risk_amount": 5000, "profit_target_entry": 120, "profit_target_exit": 130,
  "position_sizing": "1 lot", "playbook_id": "uuid",
  "what_worked": "...", "what_didnt": "...", "lessons_learned": "...",
  "emotions": "Confident,Calm", "important_notes": "..." }
```

---

## Data Flow

```
Broker CSV
  → csv-parser.ts (parse rows → individual fills)
  → trade-matcher.ts (collapseFills → position tracker → complete trades)
  → supabase.ts (store orders + replace trades)
  → /api/trades (serve to frontend)
```

```
Journal Tab / Trade Detail
  → localStorage (instant read/write, auto-save on keystroke)
  → /api/daily-journal or /api/trade-journal (explicit save → Supabase)
  → On mount: localStorage first, then API overwrites if newer
```
