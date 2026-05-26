import { NextResponse } from 'next/server';
import { fetchAllTrades } from '@/lib/db/supabase';

export async function GET() {
  try {
    const trades = await fetchAllTrades();
    return NextResponse.json(trades);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
