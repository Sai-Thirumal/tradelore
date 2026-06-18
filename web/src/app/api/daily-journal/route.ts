import { NextResponse } from 'next/server';
import { fetchDailyJournal, saveDailyJournal } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';
import { getErrorMessage } from '@/lib/errors';
import { validateDailyJournalPayload } from '@/lib/validation/journal';
import { readJsonObject, validationErrorResponse } from '@/lib/validation/request';

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const entry = await fetchDailyJournal(date, user.id);
    return NextResponse.json(entry || null);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = validateDailyJournalPayload(await readJsonObject(request));
    const entry = await saveDailyJournal(body, user.id);
    return NextResponse.json(entry);
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
