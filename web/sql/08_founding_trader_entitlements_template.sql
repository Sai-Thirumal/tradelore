-- Template only. Replace placeholders from an authoritative founding-trader list.
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
  '2027-01-11T00:00:00Z',
  'authoritative_founding_trader_list'
);
