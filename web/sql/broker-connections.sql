-- Broker connections for per-user Zerodha/Kite Personal API credentials.
-- API secrets and daily access tokens are encrypted server-side before storage.
-- Do not expose this table directly to clients; use server API routes that return
-- sanitized metadata only.

CREATE TABLE IF NOT EXISTS public.broker_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker text NOT NULL,
  api_key text DEFAULT '',
  encrypted_api_secret text,
  credentials_saved_at timestamptz,
  broker_user_id text DEFAULT '',
  broker_user_name text DEFAULT '',
  encrypted_access_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text DEFAULT '',
  last_sync_error text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, broker)
);

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS api_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS encrypted_api_secret text,
  ADD COLUMN IF NOT EXISTS credentials_saved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_broker_connections_user_broker
  ON public.broker_connections(user_id, broker);

ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own broker connections" ON public.broker_connections;
DROP POLICY IF EXISTS "Users can insert own broker connections" ON public.broker_connections;
DROP POLICY IF EXISTS "Users can update own broker connections" ON public.broker_connections;
DROP POLICY IF EXISTS "Users can delete own broker connections" ON public.broker_connections;

REVOKE ALL ON public.broker_connections FROM anon, authenticated;
