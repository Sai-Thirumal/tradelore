-- Raw orders imported from broker CSV.
-- Every row in the CSV becomes one row here.
-- uid is a dedup key so re-importing the same CSV is safe.

CREATE TABLE trade_orders (
  uid         text PRIMARY KEY,
  symbol      text NOT NULL,
  exchange    text DEFAULT '',
  segment     text DEFAULT '',        -- e.g. 'FO', 'EQ'
  expiry_date text DEFAULT '',        -- options/futures expiry
  trade_time  text NOT NULL,
  order_id    text DEFAULT '',
  trade_id    text DEFAULT '',
  type        text NOT NULL,
  qty         numeric NOT NULL,
  price       numeric NOT NULL,
  imported_at timestamptz DEFAULT now()
);

ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_access" ON trade_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Run this if the table already exists (safe to skip if creating fresh):
-- ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS segment     text DEFAULT '';
-- ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';
