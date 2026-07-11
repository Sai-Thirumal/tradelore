# Razorpay Subscriptions

TradeLore uses an internal no-card 30-day trial. The trial creates a `new_user_trial` entitlement only; it does not create a Razorpay customer or subscription and never asks for payment details.

Trial trigger: first successful authenticated dashboard entry, implemented by `GET /api/auth/me`, for users created on or after 2026-07-11. Opening billing settings and `GET /api/billing/status` do not independently start a trial. Existing users are not auto-backfilled; use `sql/09_existing_user_trial_migration_template.sql` only after approving a user list.

Plans are monthly only:
- `pro_launch_monthly`: ₹199/month, enabled by `TRADELORE_LAUNCH_PLAN_ENABLED=true`.
- `pro_standard_monthly`: ₹299/month.

If a trial user subscribes early, Razorpay billing starts immediately after authorization/payment. Paid subscription access supersedes remaining trial time. Launch subscribers keep the ₹199 provider plan only while continuously subscribed.

Entitlement selection considers every currently valid entitlement and paid subscription period. It returns the source with the furthest legitimate expiry; source priority is only a tie-breaker, so a shorter trial cannot hide a longer paid period and a shorter founding entitlement cannot hide a longer subscription.

Founding traders get six months through `sql/08_founding_trader_entitlements_template.sql` using an explicit UUID list. Do not infer by signup date or email domain.

Required env:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_LAUNCH_MONTHLY_PLAN_ID`
- `RAZORPAY_STANDARD_MONTHLY_PLAN_ID`
- `TRADELORE_LAUNCH_PLAN_ENABLED`

Razorpay Dashboard:
1. Create two monthly plans in Test Mode matching ₹199 and ₹299.
2. Copy plan IDs into env.
3. Configure webhook URL `/api/webhooks/razorpay`.
4. Select subscription authenticated, activated, charged, pending, halted, cancelled, completed and payment failed events.
5. Repeat with Live Mode keys and plan IDs before launch.

Checkout creates a Razorpay subscription only after an authenticated user clicks upgrade. The browser receives only the public key, subscription ID and safe display details. Checkout signature verification is server-side and provisional; webhooks remain authoritative.

The official Razorpay SDK was not installed in this repository. The foundation uses direct HTTPS with a tiny wrapper to avoid adding an SDK solely for two endpoints; all calls are isolated for mocking.

Webhook processing verifies the exact raw body before JSON parsing, then invokes `public.process_razorpay_billing_webhook` through the service-role server path. The function reserves the event key, updates allowlisted subscription fields using provider timestamps only, handles duplicates idempotently, and marks the event processed only after subscription reconciliation succeeds. Generic `payment.failed` records payment failure details and changes subscription status only when Razorpay includes a subscription entity/status such as `pending` or `halted`.

Cancellation uses Razorpay `cancel_at_cycle_end: true`, preserves access until verified provider `current_period_end`, and leaves webhook reconciliation authoritative. Launch-price subscribers keep ₹199 only while continuously subscribed.

Rollback before production data exists: drop `public.process_razorpay_billing_webhook`, then drop `billing_webhook_events`, `billing_subscriptions`, and `user_entitlements`. After production data exists, take a backup first and prefer disabling routes/env over dropping billing tables.

Secret rotation: rotate Razorpay keys and webhook secret in the dashboard, update production env, then redeploy. Manual reconciliation: compare `billing_subscriptions.provider_subscription_id` with Razorpay subscription state and update only allowlisted lifecycle fields.
