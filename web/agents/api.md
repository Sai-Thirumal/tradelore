# TradeLore — API Reference

## Route Tree

```
/api/
├── auth/
│   ├── me/           GET   — Current authenticated user
│   ├── logout/       POST  — Sign out current user
│   └── signup/       POST  — First-100 launch signup gate
├── broker/
│   ├── [broker]/
│   │   ├── credentials/ POST|DELETE — Save/delete encrypted broker API credentials
│   │   ├── disconnect/  POST        — Clear session token state while keeping credentials
│   │   ├── status/      GET         — Broker connection metadata, no secrets
│   │   └── sync/        POST        — Fetch broker fills and rebuild completed trades
│   ├── zerodha/
│   │   ├── login/       GET         — Start Kite Connect login flow
│   │   └── callback/    GET         — Exchange request_token and store encrypted daily token
│   └── upstox/
│       ├── login/       GET         — Start Upstox OAuth login flow
│       └── callback/    GET         — Exchange code and store encrypted access token
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

Password signup handling:
- `/login` sends signup passwords only to Supabase Auth.
- Supabase Auth owns password hashing and salted password storage.
- TradeLore must not store plaintext passwords or pre-hash passwords in the browser; a browser hash would become a reusable password equivalent.
- Freemium launch signup requires joining the Telegram community and calling `/api/auth/signup`, which checks the first-100 launch cap before Supabase signup.

### POST /api/auth/signup
Creates a new Supabase Auth signup only while the first-100-user freemium launch still has slots.

Requires `SUPABASE_SERVICE_ROLE_KEY` server-side so the route can count Supabase Auth users through the admin API before creating a signup.

**Request:**
```json
{ "email": "trader@example.com", "password": "StrongPass!1", "joinedTelegram": true, "next": "/dashboard" }
```

**Response:**
```json
{ "session": false }
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

### GET /api/broker/zerodha/login
Starts the Kite Connect login flow for the signed-in TradeLore user.

**Security behavior:**
- Requires Supabase Auth.
- Uses the signed-in user's saved Zerodha Personal API key.
- Sets a short-lived HTTP-only `zerodha_oauth_state` cookie and sends the same state through Kite `redirect_params` for callback verification.

**Redirects:** Kite login page, `/settings/zerodha?zerodha=credentials_required`, or `/?zerodha=not_configured` when server encryption/service-role env vars are missing.

### GET /api/broker/zerodha/callback
Receives Kite `request_token`, verifies the state cookie, decrypts the user's saved API secret server-side, exchanges the request token for a daily `access_token`, encrypts the token, and upserts `broker_connections`.

**Redirects:** `/?zerodha=connected`, `/?zerodha=state_error`, `/?zerodha=missing_request_token`, `/?zerodha=credentials_required`, `/?zerodha=user_not_enabled`, or `/?zerodha=connect_failed`.

### GET /api/broker/zerodha/status
Returns Zerodha connection metadata only. Does not return raw API keys, API secrets, or access tokens.

**Response:**
```json
{
  "server_configured": true,
  "credentials_configured": true,
  "configured": true,
  "connected": true,
  "needs_reconnect": false,
  "api_key_masked": "abcd****wxyz",
  "api_secret_saved": true,
  "credentials_saved_at": "2026-06-18T05:00:00.000Z",
  "redirect_url": "https://web-phi-one-12.vercel.app/api/broker/zerodha/callback",
  "token_expires_at": "2026-06-19T00:30:00.000Z",
  "last_sync_at": "2026-06-18T05:01:00.000Z",
  "last_sync_status": "success",
  "last_sync_error": "",
  "broker_user_id": "AB1234",
  "broker_user_name": "Sai",
  "today": "2026-06-18"
}
```

### POST /api/broker/zerodha/sync
Fetches today's executed order fills from Kite `GET /trades`, normalizes them into TradeLore `TradeOrder[]`, stores them idempotently, runs `matchTrades()`, and replaces completed trades for the user. For NFO, BFO, and MCX fills, sync downloads only the relevant Zerodha instrument masters and enriches fills with exact expiry, strike, instrument type, lot-size step, and segment. MCX additionally receives commodity family and TradeLore's contract-value multiplier.

Unmatched/unrealized positions remain intentionally omitted; only positions that return to zero become `trades`.

**Response:**
```json
{
  "imported_orders": 14,
  "total_orders": 248,
  "total_trades": 51,
  "raw_fills": 248,
  "fills_with_order_id": 248,
  "unique_order_ids": 221,
  "collapsed_fills": 221,
  "synced_at": "2026-06-18T05:05:00.000Z"
}
```

**Errors:**
- `409 { "needs_reconnect": true }` when Kite returns a token/session error or the stored token has passed its 6 AM IST expiry window.
- `503` when Zerodha server encryption/service-role env vars are not configured.

### POST /api/broker/zerodha/credentials
Saves a user's Zerodha Personal API key and encrypted API secret. Clears any existing access token because tokens are tied to the API key.

### DELETE /api/broker/zerodha/credentials
Deletes the saved API key, encrypted API secret, encrypted access token, and broker user metadata.

### POST /api/broker/zerodha/disconnect
Deletes only the encrypted access token and broker user metadata; keeps the saved API key and encrypted API secret.

### Generic Broker Adapter Routes
The adapter-backed routes support `zerodha`, `dhan`, `upstox`, `angelone`, and `delta` where each broker is registered in `lib/brokers/core/registry.ts`.

- `GET /api/broker/[broker]/status` returns sanitized connection metadata.
- `POST /api/broker/[broker]/credentials` saves encrypted credential fields defined by the broker adapter.
- `DELETE /api/broker/[broker]/credentials` deletes saved credential/session fields.
- `POST /api/broker/[broker]/disconnect` clears connected/session state while keeping saved credentials.
- `POST /api/broker/[broker]/sync` runs the broker sync adapter, stores raw fills idempotently, runs `matchTrades()`, and replaces completed trades.

Broker credential meanings:
- Zerodha: API key + API secret; login/callback stores daily access token.
- Dhan: Client ID + DhanHQ access token.
- Upstox: API key + API secret; login/callback stores access token.
- Angel One: SmartAPI key + JWT token.
- Delta: API key + API secret.

Angel One sync calls SmartAPI `getTradeBook`, normalizes fills into `TradeOrder[]`, and follows the common sync pipeline. It intentionally does not store Angel One PIN/TOTP; users provide a fresh JWT token when needed.

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
Upload a supported broker CSV file. Full pipeline: parse → store orders → fetch all orders → match trades → replace trades.

**Request:** `multipart/form-data` with `broker=zerodha` or `broker=delta` and `file` field (CSV)

**Validation:**
- Supported CSV brokers: Zerodha and Delta only (`broker=zerodha|delta`)
- Max file size: 10 MB (`413`)
- Max data rows: 50,000 (`413`)
- Required Zerodha columns: symbol, exchange, trade_date, trade_type, quantity, price, trade_id, order_id, and order_execution_time (`400`)
- Optional MCX columns: `expiry_date`, `instrument_name`, `instrument_type`, `strike`, `lot_size`, and `price_multiplier`/`contract_multiplier`
- Known MCX symbols are enriched from the built-in contract catalog. Unknown contracts use a visible estimated-calculation warning unless the CSV supplies a multiplier.
- Invalid individual rows are skipped by the parser; if no valid orders remain, returns `422`

**Response:**
```json
{
  "broker": "zerodha",
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
- `exchange` — exchange code; required for MCX-aware resolution
- `from` — entry datetime (e.g., `2025-02-01 14:07:00`)
- `to` — exit datetime

**Behavior:**
- Extracts underlying (NIFTY → `^NSEI` on Yahoo Finance)
- MCX Gold, Silver, Crude Oil, Natural Gas, and Copper use global Yahoo futures as clearly labelled reference charts; unsupported commodities return `404` instead of being mapped to an incorrect `.NS` symbol
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

Unknown JSON fields return `400`. Text fields are limited to 500 words each. `capital_to_deploy` must be a finite number from 0 to 1,000,000,000.

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

Unknown JSON fields return `400`. `name` is required and limited to 80 characters. Select/tag fields must use known UI values. `risk_percent` must be 0–100. Short select-like text fields are capped at 100 characters; long rule/note fields are limited to 500 words.

**Body:** `{ "name": "My Setup", "data": { "markets": ["Stocks"], ... } }`
**Response:** Created playbook (201)

### PUT /api/playbooks
Update an existing playbook.

Uses the same validation as create, plus required `id`. Unknown JSON fields return `400`.

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
- `group` — one of `days`, `months`, `trade-time`, `trade-duration`, `instruments`, `deployed-capital`, `playbooks`, `options-expiry`; defaults to `days`

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
- `deployed-capital`: dynamic contract-notional ranges from `avg_entry * qty * price_multiplier`; buckets use rounded uniform steps and boundary values belong to one range only
- `playbooks`: journal-tagged trades grouped by `trade_journal.playbook_id`; untagged trades are excluded
- `options-expiry`: option trades grouped by market-session time from entry to expiry close; MCX requires imported instrument-master expiry and uses the MCX 9:00 AM/evening session with the US daylight-saving close schedule. NSE/BSE can fall back to option-symbol parsing.

### GET /api/trade-journal
Get journal entry for a specific trade. If `trade_id` is omitted, returns the set of journaled trade IDs that have at least one filled field.

**Params:** `trade_id` (optional)
**Response:** `TradeJournal | null | { trade_ids: string[] }`

### POST /api/trade-journal
Save or update per-trade journal. Upserts on `trade_id`.

Unknown JSON fields return `400`. Free-text journal fields are limited to 500 words each. Numeric fields must be finite numbers from 0 to 1,000,000,000.

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
  → NFO/BFO/MCX metadata enrichment (instrument master; MCX also uses contract catalog)
  → trade-matcher.ts (collapseFills → position tracker → complete trades + commission)
  → supabase.ts (store user-owned orders + replace only that user's trades)
  → /api/trades (serve to frontend)
```

```
Auth
  → proxy.ts refreshes Supabase cookies and redirects protected page routes
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
