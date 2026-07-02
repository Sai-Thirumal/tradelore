-- Delta/crypto derivatives metadata. Safe to run on existing databases.

ALTER TABLE public.trade_orders
  ADD COLUMN IF NOT EXISTS broker text DEFAULT 'zerodha',
  ADD COLUMN IF NOT EXISTS market_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_id bigint,
  ADD COLUMN IF NOT EXISTS product_symbol text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS notional_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS base_asset text DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote_asset text DEFAULT '',
  ADD COLUMN IF NOT EXISTS settlement_asset text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_value numeric,
  ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_asset text DEFAULT '',
  ADD COLUMN IF NOT EXISTS liquidity_role text DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_trade_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_order_id text DEFAULT '';

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS broker text DEFAULT 'zerodha',
  ADD COLUMN IF NOT EXISTS market_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_id bigint,
  ADD COLUMN IF NOT EXISTS product_symbol text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS notional_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS settlement_asset text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_value numeric,
  ADD COLUMN IF NOT EXISTS funding numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pnl_currency text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_trade_orders_user_broker_time
  ON public.trade_orders(user_id, broker, trade_time);

CREATE INDEX IF NOT EXISTS idx_trades_user_broker_exit_time
  ON public.trades(user_id, broker, exit_time);

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS last_sync_cursor text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.delta_products (
  symbol text PRIMARY KEY,
  product_id bigint,
  contract_type text DEFAULT '',
  notional_type text DEFAULT '',
  contract_value numeric DEFAULT 1,
  contract_unit_currency text DEFAULT '',
  quoting_asset text DEFAULT '',
  settling_asset text DEFAULT '',
  expiry_time text DEFAULT '',
  settlement_time text DEFAULT '',
  settlement_method text DEFAULT '',
  raw jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delta_products_product_id
  ON public.delta_products(product_id);
