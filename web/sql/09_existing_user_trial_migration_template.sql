-- Template only. Leave unrun until an explicit existing-user trial policy is approved.
-- This grants a one-time 30-day trial to selected users by UUID.

INSERT INTO public.user_entitlements (
  user_id,
  source,
  status,
  starts_at,
  expires_at,
  reason
)
SELECT
  id,
  'new_user_trial',
  'active',
  now(),
  now() + interval '30 days',
  'approved_existing_user_trial_migration'
FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT DO NOTHING;
