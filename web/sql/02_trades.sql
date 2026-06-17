-- Pre-computed matched trades produced by the Python backend.
-- The browser reads this table — never the raw orders table.
-- Python deletes and re-inserts all rows here on every CSV import.

CREATE TABLE trades (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol      text NOT NULL,
  exchange    text DEFAULT '',
  segment     text DEFAULT '',        -- e.g. 'FO', 'EQ'
  expiry_date text DEFAULT '',        -- options/futures expiry
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

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_access" ON trades
  FOR ALL USING (true) WITH CHECK (true);

-- Run this if the table already exists (safe to skip if creating fresh):
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS segment     text DEFAULT '';
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';
