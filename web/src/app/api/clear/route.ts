import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';

export async function DELETE() {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    await clearAllData(user.id);
    return NextResponse.json({ success: true, message: 'All data cleared successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
