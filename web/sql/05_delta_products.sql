-- Small public Delta product metadata cache used by server-side imports/sync.

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
