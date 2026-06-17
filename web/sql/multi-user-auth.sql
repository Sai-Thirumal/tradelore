-- ================================================================
-- TradeLore Multi-User Auth Migration
-- Run in Supabase SQL Editor after enabling Supabase Auth.
-- ================================================================

-- 1. Add owner columns.
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.daily_journal ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add trade cost columns used by current app code.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission_breakdown JSONB;

-- 3. Existing data backfill.
-- Create/sign in your owner user first, then replace the UUID below and run
-- these UPDATE statements if you want old local data to belong to that user.
--
-- UPDATE public.trade_orders SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
-- UPDATE public.trades SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
-- UPDATE public.trade_journal SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
-- UPDATE public.daily_journal SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
--
-- Keep seeded playbooks with user_id NULL as global templates. TradeLore clones
-- those defaults into each user's account the first time they open Playbooks.

-- 4. Per-user uniqueness.
ALTER TABLE public.daily_journal DROP CONSTRAINT IF EXISTS daily_journal_date_key;
DROP INDEX IF EXISTS idx_trade_journal_trade_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_journal_user_trade_id
  ON public.trade_journal(user_id, trade_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_journal_user_date
  ON public.daily_journal(user_id, date);

-- Raw order uid remains the primary key. The app prefixes uid with user_id
-- before insert so different users can import broker files with matching IDs.

-- 5. Query indexes.
CREATE INDEX IF NOT EXISTS idx_trade_orders_user_time ON public.trade_orders(user_id, trade_time);
CREATE INDEX IF NOT EXISTS idx_trades_user_exit_time ON public.trades(user_id, exit_time);
CREATE INDEX IF NOT EXISTS idx_trades_user_trade_date ON public.trades(user_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_playbooks_user_name ON public.playbooks(user_id, name);
CREATE INDEX IF NOT EXISTS idx_trade_journal_user_playbook ON public.trade_journal(user_id, playbook_id);

-- 6. Replace permissive policies with user-owned RLS.
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.trade_orders;
DROP POLICY IF EXISTS "Allow all" ON public.trades;
DROP POLICY IF EXISTS "Allow all" ON public.playbooks;
DROP POLICY IF EXISTS "Allow all" ON public.trade_journal;
DROP POLICY IF EXISTS "Allow all" ON public.daily_journal;

DROP POLICY IF EXISTS "public_access" ON public.trade_orders;
DROP POLICY IF EXISTS "public_access" ON public.trades;
DROP POLICY IF EXISTS "public_access" ON public.playbooks;
DROP POLICY IF EXISTS "public_access" ON public.trade_journal;
DROP POLICY IF EXISTS "public_access" ON public.daily_journal;

DROP POLICY IF EXISTS "Users can read own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can insert own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can update own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can delete own trade orders" ON public.trade_orders;

DROP POLICY IF EXISTS "Users can read own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;

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

CREATE POLICY "Users can read own trade orders"
  ON public.trade_orders FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade orders"
  ON public.trade_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade orders"
  ON public.trade_orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade orders"
  ON public.trade_orders FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE
  USING (auth.uid() = user_id);

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
