-- Pre-computed matched trades produced by the Python backend.
-- The browser reads this table — never the raw orders table.
-- Python deletes and re-inserts all rows here on every CSV import.

CREATE TABLE public.trades (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol      text NOT NULL,
  exchange    text DEFAULT '',
  segment     text DEFAULT '',        -- e.g. 'FO', 'EQ'
  expiry_date text DEFAULT '',        -- options/futures expiry
  instrument_name text DEFAULT '',
  instrument_type text DEFAULT '',
  strike numeric DEFAULT 0,
  lot_size numeric DEFAULT 1,
  price_multiplier numeric DEFAULT 1,
  commodity_class text DEFAULT '',
  calculation_status text DEFAULT 'exact',
  calculation_warnings jsonb DEFAULT '[]',
  direction   text NOT NULL,          -- 'LONG' or 'SHORT'
  qty         numeric NOT NULL,
  avg_entry   numeric NOT NULL,
  avg_exit    numeric NOT NULL,
  pnl         numeric NOT NULL,       -- realized P&L only
  entry_time  text NOT NULL,
  exit_time   text NOT NULL,
  trade_date  date NOT NULL,
  result      text NOT NULL,          -- 'win', 'loss', or 'breakeven'
  orders      jsonb DEFAULT '[]',     -- individual order legs (for the Orders expand)
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission_breakdown JSONB;

CREATE INDEX IF NOT EXISTS idx_trades_user_exit_time ON public.trades(user_id, exit_time);
CREATE INDEX IF NOT EXISTS idx_trades_user_trade_date ON public.trades(user_id, trade_date);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_access" ON public.trades;
DROP POLICY IF EXISTS "Users can read own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;

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

-- Run this if the table already exists (safe to skip if creating fresh):
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS segment     text DEFAULT '';
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
