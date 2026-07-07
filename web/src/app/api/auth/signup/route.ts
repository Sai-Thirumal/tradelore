import { NextResponse, type NextRequest } from 'next/server';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { internalErrorResponse } from '@/lib/errors';
import { hasSupabaseServiceRoleEnv } from '@/lib/supabase/env';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

const LAUNCH_SIGNUP_LIMIT = 100;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

interface SignupPayload {
  email?: unknown;
  password?: unknown;
  next?: unknown;
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as SignupPayload | null;
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const next = getInternalRedirectPath(typeof payload?.next === 'string' ? payload.next : null);

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (!STRONG_PASSWORD_PATTERN.test(password)) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters and include lowercase, uppercase, digit, and symbol characters.' },
      { status: 400 },
    );
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      { error: 'Launch signup limit is not configured.' },
      { status: 503 },
    );
  }

  const serviceClient = createServiceClient();
  const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (usersError) {
    return internalErrorResponse(usersError, 'Unable to check launch signup availability.');
  }

  const used = usersData.total ?? usersData.users.length;
  if (used >= LAUNCH_SIGNUP_LIMIT) {
    return NextResponse.json(
      { error: 'The first 100-user freemium launch is full.' },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error('Unable to sign up user.', error);
    return NextResponse.json({ error: 'Unable to create account. Please check your details and try again.' }, { status: 400 });
  }

  return NextResponse.json({ session: Boolean(data.session) });
}
