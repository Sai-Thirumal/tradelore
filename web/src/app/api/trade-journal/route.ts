import { NextResponse } from 'next/server';
import { fetchTradeJournal, saveTradeJournal } from '@/lib/db/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('trade_id');
    if (!tradeId) {
      return NextResponse.json({ error: 'trade_id required' }, { status: 400 });
    }
    const entry = await fetchTradeJournal(tradeId);
    return NextResponse.json(entry || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.trade_id) {
      return NextResponse.json({ error: 'trade_id required' }, { status: 400 });
    }
    const entry = await saveTradeJournal(body);
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
