import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthUser {
  id: string;
  email?: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as Record<string, unknown>;
    return {
      id: String(claims.sub),
      email: typeof claims.email === 'string' ? claims.email : undefined,
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
