create table if not exists delta_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_transaction_id text not null,
  transaction_type text not null,
  amount numeric not null default 0,
  asset text not null,
  product_id bigint,
  product_symbol text,
  occurred_at timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_transaction_id)
);

create index if not exists delta_wallet_transactions_user_time_idx
  on delta_wallet_transactions (user_id, occurred_at);

create index if not exists delta_wallet_transactions_user_product_day_idx
  on delta_wallet_transactions (user_id, product_symbol, occurred_at);
