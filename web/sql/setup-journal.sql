-- TradeLore Journal Tables
-- Run this in the Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/unxqubbzwskhesjytyhh/sql/new

-- Playbooks table (trading strategies)
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  criteria TEXT DEFAULT '',
  entry_rules TEXT DEFAULT '',
  exit_rules TEXT DEFAULT '',
  position_sizing TEXT DEFAULT '',
  rating INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trade journal table (per-trade post-market analysis)
CREATE TABLE IF NOT EXISTS public.trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT NOT NULL,
  risk_amount NUMERIC,
  profit_target_entry NUMERIC,
  profit_target_exit NUMERIC,
  position_sizing TEXT DEFAULT '',
  playbook_id TEXT DEFAULT '',
  what_worked TEXT DEFAULT '',
  what_didnt TEXT DEFAULT '',
  lessons_learned TEXT DEFAULT '',
  emotions TEXT DEFAULT '',
  important_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily journal table (pre-market plan)
CREATE TABLE IF NOT EXISTS public.daily_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  market_outlook TEXT DEFAULT '',
  outlook_bias TEXT DEFAULT '',
  capital_to_deploy NUMERIC,
  playbooks_planned TEXT DEFAULT '',
  key_levels TEXT DEFAULT '',
  news_events TEXT DEFAULT '',
  pre_market_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Owner columns for per-user data isolation.
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.daily_journal ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Per-user uniqueness and query indexes.
ALTER TABLE public.daily_journal DROP CONSTRAINT IF EXISTS daily_journal_date_key;
DROP INDEX IF EXISTS idx_trade_journal_trade_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_journal_user_trade_id
  ON public.trade_journal(user_id, trade_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_journal_user_date
  ON public.daily_journal(user_id, date);

CREATE INDEX IF NOT EXISTS idx_playbooks_user_name ON public.playbooks(user_id, name);
CREATE INDEX IF NOT EXISTS idx_trade_journal_user_playbook ON public.trade_journal(user_id, playbook_id);

-- Enable RLS
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_journal ENABLE ROW LEVEL SECURITY;

-- User-owned RLS. Never create broad Allow all/public policies.
DROP POLICY IF EXISTS "Allow all" ON public.playbooks;
DROP POLICY IF EXISTS "Allow all" ON public.trade_journal;
DROP POLICY IF EXISTS "Allow all" ON public.daily_journal;

DROP POLICY IF EXISTS "Users can read own playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Users can insert own playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Users can update own playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Users can delete own playbooks" ON public.playbooks;

DROP POLICY IF EXISTS "Users can read own trade journals" ON public.trade_journal;
DROP POLICY IF EXISTS "Users can insert own trade journals" ON public.trade_journal;
DROP POLICY IF EXISTS "Users can update own trade journals" ON public.trade_journal;
DROP POLICY IF EXISTS "Users can delete own trade journals" ON public.trade_journal;

DROP POLICY IF EXISTS "Users can read own daily journals" ON public.daily_journal;
DROP POLICY IF EXISTS "Users can insert own daily journals" ON public.daily_journal;
DROP POLICY IF EXISTS "Users can update own daily journals" ON public.daily_journal;
DROP POLICY IF EXISTS "Users can delete own daily journals" ON public.daily_journal;

CREATE POLICY "Users can read own playbooks"
  ON public.playbooks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own playbooks"
  ON public.playbooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own playbooks"
  ON public.playbooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own playbooks"
  ON public.playbooks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own trade journals"
  ON public.trade_journal FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade journals"
  ON public.trade_journal FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade journals"
  ON public.trade_journal FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade journals"
  ON public.trade_journal FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own daily journals"
  ON public.daily_journal FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily journals"
  ON public.daily_journal FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily journals"
  ON public.daily_journal FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily journals"
  ON public.daily_journal FOR DELETE
  USING (auth.uid() = user_id);

-- Seed default playbooks
INSERT INTO public.playbooks (name, description, entry_rules, exit_rules, rating) VALUES
  ('Trend Following', 'Ride established trends. Enter on pullbacks to 20 EMA with bullish confirmation.', 'Price above 20 EMA, pullback to EMA, bullish candle close above previous candle high', 'Trail stop at swing low, take profit at 2R minimum', 4),
  ('Mean Reversion', 'Buy oversold, sell overbought. Use RSI and Bollinger Bands for entries.', 'RSI below 30 or price at lower Bollinger Band with reversal candle', 'Exit at middle Bollinger Band or RSI 50', 3),
  ('Breakout Trading', 'Enter on clean breaks of key levels with volume confirmation.', 'Price breaks pivot high/low on 15-min close, volume > 1.5x average', 'Stop below breakout candle low, target measured move of range', 4),
  ('Options Selling', 'Sell OTM options, harvest theta decay. Manage winners early.', 'IV rank > 50, 15-20 DTE, delta < 0.30, credit >= 1% of strike width', 'Take profit at 50% of credit received, stop loss at 2x credit', 3),
  ('Gap Trading', 'Trade the gap fill or gap continuation on market open.', 'Gap > 1% from previous close, wait for first 15-min candle to set direction', 'Target gap fill level or previous close for partials', 2)
ON CONFLICT DO NOTHING;
