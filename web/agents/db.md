# TradeLore — Database Reference

**Provider:** Supabase (PostgreSQL)  
**Project:** `unxqubbzwskhesjytyhh`  
**Schema:** `public`

---

## Tables

### `trade_orders`
Raw broker fills. One row = one exchange execution. Not a trade — multiple fills per order.

```sql
CREATE TABLE public.trade_orders (
  uid          TEXT PRIMARY KEY,       -- {order_id}_{trade_id} or fallback hash
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  exchange     TEXT,
  segment      TEXT,
  expiry_date  TEXT,
  instrument_token BIGINT,
  instrument_name TEXT,
  instrument_type TEXT,              -- EQ | FUT | CE | PE
  strike       NUMERIC,
  lot_size     NUMERIC DEFAULT 1,    -- broker order-quantity step
  price_multiplier NUMERIC DEFAULT 1,-- quoted price → rupee contract value
  commodity_class TEXT,              -- agricultural | non_agricultural
  metadata_source TEXT,
  trade_time   TEXT NOT NULL,          -- "YYYY-MM-DD HH:MM:SS"
  order_id     TEXT,                   -- Broker order ID (partial fills share this)
  trade_id     TEXT,                   -- Broker execution ID (unique per fill)
  type         TEXT NOT NULL,          -- "BUY" | "SELL"
  qty          NUMERIC NOT NULL,
  price        NUMERIC NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
-- (none beyond PK — queried by order+range, full scan acceptable)
```

**Key invariant:** Multiple rows can share the same `order_id` (partial fills). `trade-matcher.ts` collapses them before position tracking.

**Multi-user invariant:** API insert code prefixes `uid` with `user_id` before upsert so two users can import broker files with matching broker IDs.

---

### `trades`
Completed trades. Built by `matchTrades()` from collapsed fills. Position fully closed = one row here.

```sql
CREATE TABLE public.trades (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  exchange     TEXT,
  segment      TEXT,
  expiry_date  TEXT,
  instrument_name TEXT,
  instrument_type TEXT,
  strike       NUMERIC,
  lot_size     NUMERIC DEFAULT 1,
  price_multiplier NUMERIC DEFAULT 1,
  commodity_class TEXT,
  calculation_status TEXT DEFAULT 'exact',
  calculation_warnings JSONB DEFAULT '[]',
  direction    TEXT NOT NULL,          -- "LONG" | "SHORT"
  qty          NUMERIC NOT NULL,
  avg_entry    NUMERIC NOT NULL,       -- Weighted avg of entry fills
  avg_exit     NUMERIC NOT NULL,       -- Weighted avg of exit fills
  pnl          NUMERIC NOT NULL,
  commission   NUMERIC DEFAULT 0,       -- Total trade costs, if migration applied
  commission_breakdown JSONB,           -- Brokerage/STT/exchange/SEBI/stamp/DP/GST
  entry_time   TEXT NOT NULL,          -- First entry fill timestamp
  exit_time    TEXT NOT NULL,          -- Last exit fill timestamp
  trade_date   TEXT NOT NULL,          -- exit_time date part (YYYY-MM-DD)
  result       TEXT NOT NULL,          -- "win" | "loss" | "breakeven"
  orders       JSONB,                  -- All fills for this trade (entry + exit)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**P&L formula:**
- LONG: `(avg_exit − avg_entry) × qty × price_multiplier`
- SHORT: `(avg_entry − avg_exit) × qty × price_multiplier`

For equities and NFO/BFO derivatives, `price_multiplier` defaults to `1`; Zerodha sync stores exact derivative expiry, strike, instrument type, lot-size step, and segment from the relevant instrument master. MCX uses a contract-value multiplier distinct from Kite's `lot_size`. Unknown MCX contracts are marked `estimated` rather than silently presented as exact.

**Commission note:**
- New matched trades include `commission` and `commission_breakdown` from `lib/engine/commission.ts`.
- Legacy rows may not have these columns populated; `/api/trades`, `/api/playbooks/stats`, and report routes compute commission on read when missing.
- UI labels that say **Net P&L** use `pnl - commission`; win/loss classification also uses net P&L.

---

### `playbooks`
Trading strategy setups. Stores all playbook detail in a `data` JSONB column. Max 8 playbooks enforced in UI.

```sql
CREATE TABLE public.playbooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',           -- legacy, being phased out
  criteria        TEXT DEFAULT '',           -- legacy
  entry_rules     TEXT DEFAULT '',           -- legacy
  exit_rules      TEXT DEFAULT '',           -- legacy
  position_sizing TEXT DEFAULT '',           -- legacy
  rating          INTEGER DEFAULT 3,        -- legacy (1–5 stars)
  data            JSONB DEFAULT '{}'::jsonb, -- all structured playbook fields
  is_default      BOOLEAN DEFAULT false,     -- true for pre-seeded example setups
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: user-owned policies via auth.uid() = user_id
-- Index: idx_playbooks_user_name ON (user_id, name)
```

**`data` JSONB structure** (8 form tabs — win rate and avg R:R are computed from tagged trades, not stored):
```
{
  markets: string[], timeframes: string[], trading_style: string,
  market_environment: string, best_session: string, macro_invalidation: string,
  entry_trigger: string, entry_confirmation: string, entry_filters: string, entry_type: string,
  stop_placement: string, stop_type: string, stop_invalidation: string,
  target_1: string, target_2: string, min_rr: string, scale_out: string,
  trailing_stop: string, early_exit_rule: string,
  risk_percent: number, grade: string,
  grade_a_plus: string, grade_b: string, ideal_chart: string,
  failure_conditions: string,
  psychology_notes: string, common_mistakes: string
}
```

**Computed stats** (from `/api/playbooks/stats` — not stored in playbooks table):
```
{
  total_trades: number, wins: number, losses: number,
  win_rate: number (0-100), avg_rr: number,
  total_pnl: number, net_pnl: number, total_commission: number,
  max_consecutive_losses: number
}
```

**Seed data (3 example playbooks):**
| Name | Style | Markets |
|------|-------|---------|
| Opening Range Breakout | Momentum | Stocks, Futures |
| VWAP Mean Reversion | Mean Reversion | Stocks, Futures |
| Trend Continuation Pullback | Trend Following | Stocks, Indices, Options, Futures |

Markets options: `['Stocks', 'Indices', 'Options', 'Futures']`

Seed rows with `user_id IS NULL` act as global templates. `fetchPlaybooks(userId)` clones them into a user's account on first playbook load.

---

### `trade_journal`
Per-trade post-market analysis. One row per trade. Synced with localStorage on the frontend.

```sql
CREATE TABLE public.trade_journal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id              TEXT NOT NULL,              -- matches Trade.getTradeId()
  risk_amount           NUMERIC,
  profit_target_entry   NUMERIC,
  profit_target_exit    NUMERIC,
  position_sizing       TEXT DEFAULT '',
  playbook_id           TEXT DEFAULT '',            -- FK to playbooks.id (soft)
  what_worked           TEXT DEFAULT '',
  what_didnt            TEXT DEFAULT '',
  lessons_learned       TEXT DEFAULT '',
  emotions              TEXT DEFAULT '',            -- Comma-separated: "Confident,Calm"
  important_notes       TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_trade_journal_user_trade_id ON public.trade_journal(user_id, trade_id);
-- Upsert key: user_id,trade_id
```

**Emotions enum (stored as CSV):**
Confident, Anxious, Frustrated, Calm, Excited, Disciplined, Overtrading, Revenge Trading

---

### `daily_journal`
Pre-market plan. One row per date.

```sql
CREATE TABLE public.daily_journal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,                  -- "YYYY-MM-DD"
  market_outlook    TEXT DEFAULT '',
  outlook_bias      TEXT DEFAULT '',                -- "Bullish"|"Bearish"|"Neutral"|"Choppy"|"Wait & Watch"
  capital_to_deploy NUMERIC,
  playbooks_planned TEXT DEFAULT '',                -- Comma-separated playbook IDs
  key_levels        TEXT DEFAULT '',
  news_events       TEXT DEFAULT '',
  pre_market_notes  TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_daily_journal_user_date ON public.daily_journal(user_id, date);
-- Unique constraint on user_id,date enforces one plan per user per day
-- Upsert key: user_id,date
```

---

### `broker_connections`
Per-user broker connection metadata. Broker API secrets/tokens are encrypted server-side; API responses return only masked/sanitized metadata.

```sql
CREATE TABLE public.broker_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker text NOT NULL,
  api_key text DEFAULT '',
  encrypted_api_key text,
  encrypted_api_secret text,
  credentials_saved_at timestamptz,
  broker_user_id text DEFAULT '',
  broker_user_name text DEFAULT '',
  encrypted_access_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text DEFAULT '',
  last_sync_error text DEFAULT '',
  last_sync_cursor text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, broker)
);
CREATE INDEX idx_broker_connections_user_broker ON public.broker_connections(user_id, broker);
```

**Security invariants:**
- `encrypted_api_key`, `encrypted_api_secret`, and `encrypted_access_token` are encrypted server-side with `BROKER_TOKEN_ENCRYPTION_KEY` using AES-256-GCM.
- Direct client access to `broker_connections` is revoked; server routes use the Supabase service role and filter by the authenticated user id.
- API responses expose only masked API key, booleans, broker metadata, and sync state; never raw API secret or access token.
- Registered broker IDs are `zerodha`, `dhan`, `upstox`, `angelone`, and `delta`.

---

## Foreign Keys

| Source | Target | Type |
|--------|--------|------|
| `*.user_id` | `auth.users.id` | Hard FK with cascade delete |
| `trade_journal.playbook_id` | `playbooks.id` | Soft (TEXT, not enforced at DB level) |
| `trade_journal.trade_id` | (derived from `trades`) | Logical only — no DB FK |

---

## Row Level Security

All app tables have RLS enabled with user-owned policies:
```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

Authentication happens through Supabase Auth. API handlers filter by `user_id` explicitly and `lib/db/supabase.ts` uses the signed-in user's request-scoped Supabase session, so RLS policies remain active for normal app reads and writes.

---

## Pagination Note

Supabase REST API returns max 1,000 rows per query. Functions that can exceed this (`fetchAllOrders`, `fetchAllTrades`, `fetchAllTradeJournals`) must paginate with `.range(from, to)` and `.eq('user_id', userId)`. Functions with `.single()`, `.maybeSingle()`, or small tables (playbooks) are exempt.

## Migration Order

Run in Supabase SQL Editor:
1. `sql/setup-journal.sql`
2. `sql/playbooks-migration.sql`
3. `sql/multi-user-auth.sql`
4. `sql/broker-connections.sql`
5. `sql/03_mcx_support.sql`

When old data is not needed, run `multi-user-auth.sql` as-is. Its commented `UPDATE ... user_id = ...` block is only for preserving existing rows by assigning them to a first Supabase Auth user.

After migration, old rows with `user_id IS NULL` are intentionally invisible to signed-in users under RLS. New imports create user-owned rows.
