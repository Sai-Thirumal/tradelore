import { NextResponse } from 'next/server';
import { fetchDailyJournal, saveDailyJournal } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const entry = await fetchDailyJournal(date, user.id);
    return NextResponse.json(entry || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = await request.json();
    const entry = await saveDailyJournal(body, user.id);
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
