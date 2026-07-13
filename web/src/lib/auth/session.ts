import { NextResponse } from 'next/server';
import { ensureNewUserTrial, getUserEntitlement } from '@/lib/billing/entitlements.ts';
import { createClient } from '@/lib/supabase/server';

export interface AuthUser {
  id: string;
  email?: string;
  createdAt?: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      createdAt: data.user.created_at,
    };
  } catch {
    return null;
  }
}

export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export async function requireActiveEntitlement() {
  const { user, response } = await requireAuthUser();
  if (response || !user) return { user, response, entitlement: null };

  await ensureNewUserTrial(user.id, user.createdAt);
  const entitlement = await getUserEntitlement(user.id);
  if (!entitlement.hasAccess) {
    return {
      user,
      entitlement,
      response: NextResponse.json(
        { error: 'TradeLore Pro subscription required.', code: 'payment_required' },
        { status: 402 },
      ),
    };
  }

  return { user, response: null, entitlement };
}
