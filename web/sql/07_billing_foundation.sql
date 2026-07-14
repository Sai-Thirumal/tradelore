-- TradeLore billing foundation: entitlements, Razorpay subscriptions and webhook idempotency.
-- Run after auth is enabled. No existing users are granted access by this migration.

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('new_user_trial', 'founding_trader', 'paid_subscription', 'manual_admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON public.user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_active ON public.user_entitlements(user_id, status, starts_at, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entitlements_trial_once
  ON public.user_entitlements(user_id)
  WHERE source = 'new_user_trial';

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'razorpay'),
  provider_subscription_id text NOT NULL UNIQUE,
  provider_customer_id text,
  provider_plan_id text NOT NULL,
  internal_plan_key text NOT NULL CHECK (internal_plan_key IN ('pro_launch_monthly', 'pro_standard_monthly')),
  billing_interval text NOT NULL CHECK (billing_interval = 'monthly'),
  status text NOT NULL CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,
  latest_payment_id text,
  provider_created_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user ON public.billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_subscription ON public.billing_subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_one_open_per_user
  ON public.billing_subscriptions(user_id)
  WHERE status IN ('created', 'authenticated', 'active', 'pending', 'halted');

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'razorpay'),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  provider_object_id text,
  processing_status text NOT NULL CHECK (processing_status IN ('processing', 'processed', 'ignored', 'failed')),
  provider_event_created_at timestamptz,
  processed_at timestamptz,
  safe_error_code text,
  safe_error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider_object ON public.billing_webhook_events(provider_object_id);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can read own entitlements"
  ON public.user_entitlements FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own billing subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Users can read own billing subscriptions"
  ON public.billing_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.user_entitlements FROM anon, authenticated;
GRANT SELECT ON public.user_entitlements TO authenticated;
REVOKE ALL ON public.billing_subscriptions FROM anon, authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;
REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_razorpay_billing_webhook(
  p_event_key text,
  p_event_type text,
  p_provider_object_id text,
  p_known_event boolean,
  p_status text,
  p_provider_customer_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancelled_at timestamptz,
  p_ended_at timestamptz,
  p_latest_payment_id text,
  p_provider_created_at timestamptz,
  p_provider_event_created_at timestamptz,
  p_safe_error_code text,
  p_safe_error_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_status text;
  subscription_exists boolean;
BEGIN
  IF p_event_key IS NULL OR length(trim(p_event_key)) = 0 THEN
    RAISE EXCEPTION 'missing_event_key';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired') THEN
    RAISE EXCEPTION 'invalid_subscription_status';
  END IF;

  SELECT processing_status INTO existing_status
  FROM public.billing_webhook_events
  WHERE event_key = p_event_key
  FOR UPDATE;

  IF existing_status IN ('processed', 'ignored') THEN
    RETURN existing_status;
  END IF;

  IF existing_status IS NULL THEN
    INSERT INTO public.billing_webhook_events (
      provider,
      event_key,
      event_type,
      provider_object_id,
      processing_status,
      provider_event_created_at,
      safe_error_code,
      safe_error_message
    ) VALUES (
      'razorpay',
      p_event_key,
      COALESCE(NULLIF(p_event_type, ''), 'unknown'),
      p_provider_object_id,
      'processing',
      p_provider_event_created_at,
      p_safe_error_code,
      p_safe_error_message
    );
  ELSE
    UPDATE public.billing_webhook_events
    SET
      processing_status = 'processing',
      provider_object_id = p_provider_object_id,
      safe_error_code = p_safe_error_code,
      safe_error_message = p_safe_error_message
    WHERE event_key = p_event_key;
  END IF;

  IF NOT p_known_event THEN
    UPDATE public.billing_webhook_events
    SET processing_status = 'ignored', processed_at = now(), safe_error_code = COALESCE(p_safe_error_code, 'unknown_event')
    WHERE event_key = p_event_key;
    RETURN 'ignored';
  END IF;

  IF p_provider_object_id IS NULL OR length(trim(p_provider_object_id)) = 0 THEN
    UPDATE public.billing_webhook_events
    SET processing_status = 'ignored', processed_at = now(), safe_error_code = 'missing_subscription_id'
    WHERE event_key = p_event_key;
    RETURN 'ignored';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.billing_subscriptions
    WHERE provider = 'razorpay'
      AND provider_subscription_id = p_provider_object_id
  ) INTO subscription_exists;

  IF NOT subscription_exists THEN
    UPDATE public.billing_webhook_events
    SET processing_status = 'failed', safe_error_code = 'subscription_not_found'
    WHERE event_key = p_event_key;
    RETURN 'retry';
  END IF;

  UPDATE public.billing_subscriptions
  SET
    status = CASE
      WHEN p_status = 'authenticated'
        AND status = 'active'
        AND last_provider_event_at = p_provider_event_created_at
      THEN status
      ELSE COALESCE(p_status, status)
    END,
    provider_customer_id = COALESCE(p_provider_customer_id, provider_customer_id),
    current_period_start = COALESCE(p_current_period_start, current_period_start),
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    cancelled_at = COALESCE(p_cancelled_at, cancelled_at),
    ended_at = COALESCE(p_ended_at, ended_at),
    latest_payment_id = COALESCE(p_latest_payment_id, latest_payment_id),
    provider_created_at = COALESCE(p_provider_created_at, provider_created_at),
    last_provider_event_at = p_provider_event_created_at,
    updated_at = now()
  WHERE provider = 'razorpay'
    AND provider_subscription_id = p_provider_object_id
    AND (
      last_provider_event_at IS NULL
      OR p_provider_event_created_at IS NULL
      OR last_provider_event_at <= p_provider_event_created_at
    );

  UPDATE public.billing_webhook_events
  SET processing_status = 'processed', processed_at = now()
  WHERE event_key = p_event_key;

  RETURN 'processed';
END;
$$;

REVOKE ALL ON FUNCTION public.process_razorpay_billing_webhook(
  text, text, text, boolean, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, timestamptz, timestamptz, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_razorpay_billing_webhook(
  text, text, text, boolean, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, timestamptz, timestamptz, text, text
) TO service_role;
