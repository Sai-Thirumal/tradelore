import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/engine/csv-parser';
import { storeOrders, fetchAllOrders, replaceTrades } from '@/lib/db/supabase';
import { matchTrades } from '@/lib/engine/trade-matcher';
import { requireAuthUser } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

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

    await storeOrders(newOrders, user.id);

    const allOrders = await fetchAllOrders(user.id);
    const allTrades = matchTrades(allOrders);

    await replaceTrades(allTrades, user.id);

    // Observable metrics: raw fills vs collapsed fills vs final trades
    const fillsWithOrderId = allOrders.filter((o: any) => o.order_id).length;
    const uniqueOrderIds = new Set(allOrders.filter((o: any) => o.order_id).map((o: any) => o.order_id)).size;

    return NextResponse.json({
      imported_orders: newOrders.length,
      total_orders: allOrders.length,
      total_trades: allTrades.length,
      raw_fills: allOrders.length,
      fills_with_order_id: fillsWithOrderId,
      unique_order_ids: uniqueOrderIds,
      collapsed_fills: uniqueOrderIds + allOrders.filter((o: any) => !o.order_id).length,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
