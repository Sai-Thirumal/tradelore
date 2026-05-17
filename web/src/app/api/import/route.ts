import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/csv-parser';
import { storeOrders, fetchAllOrders, replaceTrades } from '@/lib/supabase';
import { matchTrades } from '@/lib/trade-matcher';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const newOrders = await parseCsv(text);

    if (newOrders.length === 0) {
      return NextResponse.json({ error: 'No valid orders found' }, { status: 422 });
    }

    await storeOrders(newOrders);

    const allOrders = await fetchAllOrders();
    const allTrades = matchTrades(allOrders);

    await replaceTrades(allTrades);

    return NextResponse.json({
      imported_orders: newOrders.length,
      total_orders: allOrders.length,
      total_trades: allTrades.length
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
