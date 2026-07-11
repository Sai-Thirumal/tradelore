import { buildAuthMeResponse } from '@/lib/auth/me';
import { getAuthUser } from '@/lib/auth/session';
import { ensureNewUserTrial } from '@/lib/billing/entitlements.ts';

export async function GET() {
  return buildAuthMeResponse({ getAuthUser, ensureNewUserTrial });
}
