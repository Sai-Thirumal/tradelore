-- Template only. Replace placeholders from an authoritative founding-trader list.
-- Founding-trader access expires at the end of December 31, 2026 UTC.
-- Do not infer founding traders from signup date or email domain.

INSERT INTO public.user_entitlements (
  user_id,
  source,
  status,
  starts_at,
  expires_at,
  reason
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'founding_trader',
  'active',
  '2026-07-11T00:00:00Z',
  '2026-12-31T23:59:59Z',
  'authoritative_founding_trader_list'
);
