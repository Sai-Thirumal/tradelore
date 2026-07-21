-- Shared API rate-limit counters for serverless/multi-instance deployments.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS TABLE(allowed boolean, count integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_rate_limit_input';
  END IF;

  RETURN QUERY
  INSERT INTO public.rate_limit_buckets AS bucket (key, count, reset_at, updated_at)
  VALUES (p_key, 1, now_ts + make_interval(secs => p_window_seconds), now_ts)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE WHEN bucket.reset_at <= now_ts THEN 1 ELSE bucket.count + 1 END,
    reset_at = CASE WHEN bucket.reset_at <= now_ts THEN now_ts + make_interval(secs => p_window_seconds) ELSE bucket.reset_at END,
    updated_at = now_ts
  RETURNING bucket.count <= p_limit, bucket.count, bucket.reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
