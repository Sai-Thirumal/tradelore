export type BillingInterval = 'monthly';
export type InternalPlanKey = 'pro_launch_monthly' | 'pro_standard_monthly';

export interface BillingPlan {
  key: InternalPlanKey;
  displayName: string;
  tier: 'pro';
  interval: BillingInterval;
  pricePaise: number;
  displayPrice: string;
  providerPlanId: string;
  launchPlan: boolean;
  available: boolean;
}

const PLAN_DEFS = {
  pro_launch_monthly: {
    displayName: 'TradeLore Pro Launch',
    pricePaise: 19900,
    displayPrice: '₹199/month',
    launchPlan: true,
    env: 'RAZORPAY_LAUNCH_MONTHLY_PLAN_ID',
  },
  pro_standard_monthly: {
    displayName: 'TradeLore Pro',
    pricePaise: 29900,
    displayPrice: '₹299/month',
    launchPlan: false,
    env: 'RAZORPAY_STANDARD_MONTHLY_PLAN_ID',
  },
} as const;

export function isLaunchPlanEnabled() {
  return process.env.TRADELORE_LAUNCH_PLAN_ENABLED === 'true';
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getRazorpayKeyId() {
  return requiredEnv('RAZORPAY_KEY_ID');
}

export function getRazorpayKeySecret() {
  return requiredEnv('RAZORPAY_KEY_SECRET');
}

export function getRazorpayWebhookSecret() {
  return requiredEnv('RAZORPAY_WEBHOOK_SECRET');
}

export function getBillingPlan(key: InternalPlanKey): BillingPlan {
  const def = PLAN_DEFS[key];
  const available = !def.launchPlan || isLaunchPlanEnabled();
  return {
    key,
    displayName: def.displayName,
    tier: 'pro',
    interval: 'monthly',
    pricePaise: def.pricePaise,
    displayPrice: def.displayPrice,
    providerPlanId: requiredEnv(def.env),
    launchPlan: def.launchPlan,
    available,
  };
}

export function parseInternalPlanKey(value: unknown): InternalPlanKey | null {
  return value === 'pro_launch_monthly' || value === 'pro_standard_monthly' ? value : null;
}

export function publicPlans() {
  return (Object.keys(PLAN_DEFS) as InternalPlanKey[]).map((key) => {
    const plan = getBillingPlan(key);
    return {
      key: plan.key,
      displayName: plan.displayName,
      tier: plan.tier,
      interval: plan.interval,
      displayPrice: plan.displayPrice,
      pricePaise: plan.pricePaise,
      launchPlan: plan.launchPlan,
      available: plan.available,
    };
  });
}
