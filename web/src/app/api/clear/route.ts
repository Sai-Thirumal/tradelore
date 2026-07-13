import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/db/supabase';
import { requireActiveEntitlement } from '@/lib/auth/session';

export async function DELETE() {
  try {
    const { user, response } = await requireActiveEntitlement();
    if (response) return response;

    await clearAllData(user.id);
    return NextResponse.json({ success: true, message: 'All data cleared successfully.' });
  } catch (error: unknown) {
    console.error('Unable to clear data.', error);
    return NextResponse.json({ success: false, error: 'Unable to clear data.' }, { status: 500 });
  }
}
