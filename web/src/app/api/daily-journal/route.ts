import { NextResponse } from 'next/server';
import { fetchDailyJournal, saveDailyJournal } from '@/lib/db/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const entry = await fetchDailyJournal(date);
    return NextResponse.json(entry || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = await saveDailyJournal(body);
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
