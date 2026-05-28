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
  symbol       TEXT NOT NULL,
  exchange     TEXT,
  segment      TEXT,
  expiry_date  TEXT,
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

---

### `trades`
Completed trades. Built by `matchTrades()` from collapsed fills. Position fully closed = one row here.

```sql
CREATE TABLE public.trades (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       TEXT NOT NULL,
  exchange     TEXT,
  segment      TEXT,
  expiry_date  TEXT,
  direction    TEXT NOT NULL,          -- "LONG" | "SHORT"
  qty          NUMERIC NOT NULL,
  avg_entry    NUMERIC NOT NULL,       -- Weighted avg of entry fills
  avg_exit     NUMERIC NOT NULL,       -- Weighted avg of exit fills
  pnl          NUMERIC NOT NULL,
  entry_time   TEXT NOT NULL,          -- First entry fill timestamp
  exit_time    TEXT NOT NULL,          -- Last exit fill timestamp
  trade_date   TEXT NOT NULL,          -- entry_time date part (YYYY-MM-DD)
  result       TEXT NOT NULL,          -- "win" | "loss" | "breakeven"
  orders       JSONB,                  -- All fills for this trade (entry + exit)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**P&L formula:**
- LONG: `(avg_exit − avg_entry) × qty`
- SHORT: `(avg_entry − avg_exit) × qty`

---

### `playbooks`
Trading strategy setups. Stores all playbook detail in a `data` JSONB column. Max 8 playbooks enforced in UI.

```sql
CREATE TABLE public.playbooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- RLS: Allow all (service role / anon key)
-- Index: idx_playbooks_name ON (name)
```

**`data` JSONB structure** (9 categories of fields):
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
  win_rate: number, avg_rr: number, max_consecutive_losses: number, failure_conditions: string,
  psychology_notes: string, common_mistakes: string, trade_links: string[]
}
```

**Seed data (3 example playbooks):**
| Name | Style | Markets |
|------|-------|---------|
| Opening Range Breakout | Momentum | Stocks, Futures |
| VWAP Mean Reversion | Mean Reversion | Stocks, Futures |
| Trend Continuation Pullback | Trend Following | Stocks, Futures, Forex, Crypto |

Migration SQL at `sql/playbooks-migration.sql`.

---

### `trade_journal`
Per-trade post-market analysis. One row per trade. Synced with localStorage on the frontend.

```sql
CREATE TABLE public.trade_journal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE UNIQUE INDEX idx_trade_journal_trade_id ON public.trade_journal(trade_id);
-- Upsert key: trade_id (unique constraint via index)
```

**Emotions enum (stored as CSV):**
Confident, Anxious, Frustrated, Calm, Excited, Disciplined, Overtrading, Revenge Trading

---

### `daily_journal`
Pre-market plan. One row per date.

```sql
CREATE TABLE public.daily_journal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              TEXT NOT NULL UNIQUE,           -- "YYYY-MM-DD"
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
-- Unique constraint on date enforces one plan per day
-- Upsert key: date
```

---

## Foreign Keys

| Source | Target | Type |
|--------|--------|------|
| `trade_journal.playbook_id` | `playbooks.id` | Soft (TEXT, not enforced at DB level) |
| `trade_journal.trade_id` | (derived from `trades`) | Logical only — no DB FK |

---

## Row Level Security

All tables have RLS enabled with permissive "Allow all" policies:
```sql
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.playbooks FOR ALL USING (true) WITH CHECK (true);
-- Same pattern for trade_journal, daily_journal
```

Authentication happens at the API layer via service role key or anon key. No user-level RLS needed (single-tenant dashboard).

---

## Pagination Note

Supabase REST API returns max 1,000 rows per query. Functions that can exceed this (`fetchAllOrders`, `fetchAllTrades`) must paginate with `.range(from, to)`. Functions with `.single()`, `.maybeSingle()`, or small tables (playbooks) are exempt.
