import { NextResponse } from 'next/server';
import { fetchTradeJournal, fetchAllTradeJournals, saveTradeJournal } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('trade_id');
    if (!tradeId) {
      // Return all journal trade_ids that have at least one filled field
      const all = await fetchAllTradeJournals(user.id);
      const trade_ids = all
        .filter((j: any) => {
          const hasNumber = j.risk_amount !== null || j.profit_target_entry !== null || j.profit_target_exit !== null;
          const hasText = (j.position_sizing && j.position_sizing.trim() !== '') ||
            (j.playbook_id && j.playbook_id.trim() !== '') ||
            (j.what_worked && j.what_worked.trim() !== '') ||
            (j.what_didnt && j.what_didnt.trim() !== '') ||
            (j.lessons_learned && j.lessons_learned.trim() !== '') ||
            (j.emotions && j.emotions.trim() !== '') ||
            (j.important_notes && j.important_notes.trim() !== '');
          return hasNumber || hasText;
        })
        .map((j: any) => j.trade_id);
      return NextResponse.json({ trade_ids });
    }
    const entry = await fetchTradeJournal(tradeId, user.id);
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
    if (!body.trade_id) {
      return NextResponse.json({ error: 'trade_id required' }, { status: 400 });
    }
    const entry = await saveTradeJournal(body, user.id);
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
