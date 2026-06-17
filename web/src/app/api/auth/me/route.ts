import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
