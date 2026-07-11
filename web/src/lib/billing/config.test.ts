import assert from 'node:assert/strict';
import test from 'node:test';
import { getBillingPlan, parseInternalPlanKey } from './config.ts';

test('launch plan availability follows server flag', () => {
  process.env.RAZORPAY_LAUNCH_MONTHLY_PLAN_ID = 'plan_launch';
  process.env.TRADELORE_LAUNCH_PLAN_ENABLED = 'false';
  assert.equal(getBillingPlan('pro_launch_monthly').available, false);
  process.env.TRADELORE_LAUNCH_PLAN_ENABLED = 'true';
  assert.equal(getBillingPlan('pro_launch_monthly').available, true);
});

test('standard monthly plan is always available when configured', () => {
  process.env.RAZORPAY_STANDARD_MONTHLY_PLAN_ID = 'plan_standard';
  process.env.TRADELORE_LAUNCH_PLAN_ENABLED = 'false';
  const plan = getBillingPlan('pro_standard_monthly');
  assert.equal(plan.displayPrice, '₹299/month');
  assert.equal(plan.interval, 'monthly');
  assert.equal(plan.available, true);
});

test('rejects invalid internal plan and missing provider env', () => {
  assert.equal(parseInternalPlanKey('plan_123'), null);
  delete process.env.RAZORPAY_STANDARD_MONTHLY_PLAN_ID;
  assert.throws(() => getBillingPlan('pro_standard_monthly'), /RAZORPAY_STANDARD_MONTHLY_PLAN_ID/);
});
