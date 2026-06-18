# TradeLore — API Reference

## Route Tree

```
/api/
├── auth/
│   ├── me/           GET   — Current authenticated user
│   └── logout/       POST  — Sign out current user
├── chart/            GET   — Fetch OHLC candles for underlying asset
├── clear/            DELETE — Wipe all trade data
├── daily-journal/    GET|POST — Pre-market plan by date
├── import/           POST  — Upload broker CSV, parse → match → store
├── playbooks/        GET|POST|PUT|DELETE — Trading strategy setups CRUD
│   └── stats/        GET   — Computed win rate & avg R:R per playbook from tagged trades
├── reports/
│   ├── overview/     GET   — Full report overview metrics
│   └── day-time/     GET   — Grouped performance by day/month/time/duration/instrument
├── trade-journal/    GET|POST — Per-trade post-market analysis
└── trades/           GET   — All completed trades
```

---

## Routes

### GET /api/trades
Returns all completed trades from Supabase. Paginated (no 1000-row cap). If a legacy trade has no stored commission, the route computes `commission` and `commission_breakdown` on the fly.

All app APIs require Supabase Auth. Handlers call `requireAuthUser()` and pass `user.id` to data-access functions. A missing session returns `401`.

Production Auth URL configuration in Supabase:
```
Site URL:     https://web-phi-one-12.vercel.app
Redirect URL: https://web-phi-one-12.vercel.app/auth/callback
```

### GET /api/auth/me
Returns the authenticated user claims used by the header control.

**Response:**
```json
{ "user": { "id": "auth-user-uuid", "email": "trader@example.com" } }
```

### POST /api/auth/logout
Signs out the current Supabase session and clears auth cookies.

**Response:** `{ "success": true }`

**Response:** `Trade[]`
```json
[{
  "symbol": "NIFTY2520623400PE", "exchange": "NSE",
  "direction": "LONG", "qty": 75,
  "avg_entry": 115.5, "avg_exit": 113.85,
  "pnl": -123.75, "commission": 44.25, "result": "loss",
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
- Trade ≤ 1 day → 5-min candles with 5 days of padding
- Trade > 1 day → daily candles with 2 days of padding before entry and after exit

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
    "total_pnl": 12500, "net_pnl": 12150, "total_commission": 350,
    "max_consecutive_losses": 3
  }
}
```
- `win_rate`: 0–100 integer
- `avg_rr`: actual P&L / risk_amount average
- `net_pnl`: gross P&L minus commission
- `max_consecutive_losses`: longest losing streak
- Only returns playbooks that have at least one tagged trade

### GET /api/reports/overview
Returns aggregate report metrics across all trades and journal entries.

**Response:** `OverviewStats | null`
```json
{
  "totalTrades": 408,
  "winningTrades": 220,
  "losingTrades": 170,
  "breakevenTrades": 18,
  "netPnl": 125000,
  "largestProfit": 18000,
  "largestLoss": -9000,
  "avgTradePnl": 306.37,
  "profitFactor": 1.72,
  "maxConsecutiveWins": 7,
  "maxConsecutiveLosses": 4,
  "avgHoldTimeAll": 18.5,
  "totalTradingDays": 82,
  "winningDays": 48,
  "losingDays": 34,
  "maxDrawdown": 22000,
  "avgRealisedR": 1.4,
  "totalCommissions": 12850
}
```

Notes:
- P&L fields that say `net` subtract commission.
- R-multiple fields are derived from `trade_journal.risk_amount` and profit target fields when present.
- Returns `null` when there are no trades.

### GET /api/reports/day-time
Returns grouped performance statistics for report tables/charts.

**Params:**
- `group` — one of `days`, `months`, `trade-time`, `trade-duration`, `instruments`; defaults to `days`

**Response:**
```json
{
  "groups": [
    {
      "label": "Monday",
      "winPct": 55.2,
      "netPnl": 18500,
      "tradeCount": 42,
      "avgWin": 2200,
      "avgLoss": 1500,
      "avgVolume": 75
    }
  ],
  "bestPerforming": { "label": "Monday", "netPnl": 18500 },
  "leastPerforming": { "label": "Friday", "netPnl": -4200 },
  "mostActive": { "label": "10:00", "tradeCount": 80 },
  "bestWinRate": { "label": "Tuesday", "winPct": 64.1 }
}
```

Group behavior:
- `days`: weekday names, Monday-first sort
- `months`: month names, January-December sort
- `trade-time`: entry hour bucket
- `trade-duration`: holding duration bucket
- `instruments`: extracted base instrument plus market type

### GET /api/trade-journal
Get journal entry for a specific trade. If `trade_id` is omitted, returns the set of journaled trade IDs that have at least one filled field.

**Params:** `trade_id` (optional)
**Response:** `TradeJournal | null | { trade_ids: string[] }`

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
  → requireAuthUser() (current Supabase Auth user)
  → csv-parser.ts (parse rows → individual fills)
  → trade-matcher.ts (collapseFills → position tracker → complete trades + commission)
  → supabase.ts (store user-owned orders + replace only that user's trades)
  → /api/trades (serve to frontend)
```

```
Auth
  → src/proxy.ts refreshes Supabase cookies and redirects protected page routes
  → /login creates/signs in users with Supabase Auth and only follows internal `next` redirects
  → /auth/callback exchanges email/OAuth code for a session
  → /api/auth/me powers the header Login/Logout state
```

```
Supabase database setup
  → setup-journal.sql
  → playbooks-migration.sql
  → multi-user-auth.sql (run as-is when old data is not needed)
  → RLS policies enforce auth.uid() = user_id
```

```
Reports tab
  → /api/reports/overview or /api/reports/day-time
  → fetchAllTrades() + commission backfill
  → fetchAllTradeJournals() where journal metrics are needed
  → client-side Chart.js tables/charts
```

```
Journal Tab / Trade Detail
  → localStorage (instant read/write, auto-save on keystroke)
  → /api/daily-journal or /api/trade-journal (explicit save → Supabase)
  → On mount: localStorage first, then API overwrites if newer
```
