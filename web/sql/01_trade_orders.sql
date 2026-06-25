-- Raw orders imported from broker CSV.
-- Every row in the CSV becomes one row here.
-- uid is a dedup key so re-importing the same CSV is safe.

CREATE TABLE public.trade_orders (
  uid         text PRIMARY KEY,
  symbol      text NOT NULL,
  exchange    text DEFAULT '',
  segment     text DEFAULT '',        -- e.g. 'FO', 'EQ'
  expiry_date text DEFAULT '',        -- options/futures expiry
  instrument_token bigint,
  instrument_name text DEFAULT '',
  instrument_type text DEFAULT '',
  strike numeric DEFAULT 0,
  lot_size numeric DEFAULT 1,
  price_multiplier numeric DEFAULT 1,
  commodity_class text DEFAULT '',
  metadata_source text DEFAULT '',
  trade_time  text NOT NULL,
  order_id    text DEFAULT '',
  trade_id    text DEFAULT '',
  type        text NOT NULL,
  qty         numeric NOT NULL,
  price       numeric NOT NULL,
  imported_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trade_orders_user_time ON public.trade_orders(user_id, trade_time);

ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_access" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can read own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can insert own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can update own trade orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Users can delete own trade orders" ON public.trade_orders;

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

-- Run this if the table already exists (safe to skip if creating fresh):
-- ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS segment     text DEFAULT '';
-- ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';
-- ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
