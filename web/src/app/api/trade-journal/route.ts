import { NextResponse } from 'next/server';
import { fetchTradeJournal, fetchAllTradeJournals, saveTradeJournal } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';
import { validateTradeJournalPayload } from '@/lib/validation/journal';
import { readJsonObject, validationErrorResponse } from '@/lib/validation/request';

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
        .filter((j) => {
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
        .map((j) => j.trade_id);
      return NextResponse.json({ trade_ids });
    }
    const entry = await fetchTradeJournal(tradeId, user.id);
    return NextResponse.json(entry || null);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = validateTradeJournalPayload(await readJsonObject(request));
    const entry = await saveTradeJournal(body, user.id);
    return NextResponse.json(entry);
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
