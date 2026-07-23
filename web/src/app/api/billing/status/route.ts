import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/session';
import { isLaunchPlanEnabled } from '@/lib/billing/config.ts';
import { ensureNewUserTrial, getUserEntitlement } from '@/lib/billing/entitlements.ts';
import { internalErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;
    await ensureNewUserTrial(user.id, user.createdAt);
    const entitlement = await getUserEntitlement(user.id);
    return NextResponse.json({
      hasAccess: entitlement.hasAccess,
      entitlementSource: entitlement.source,
      trialStatus: entitlement.source === 'new_user_trial' ? entitlement.status : 'none',
      trialExpiresAt: entitlement.source === 'new_user_trial' ? entitlement.expiresAt : null,
      subscriptionStatus: entitlement.source === 'paid_subscription' ? entitlement.status : 'none',
      internalPlanKey: entitlement.internalPlanKey,
      displayPrice: entitlement.displayPrice,
      currentPeriodEnd: entitlement.source === 'paid_subscription' ? entitlement.expiresAt : null,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      launchPriceActive: isLaunchPlanEnabled(),
    });
  } catch (error) {
    return internalErrorResponse(error, 'Unable to load billing status.');
  }
}
