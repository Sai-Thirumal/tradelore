import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/supabase';

export async function DELETE() {
  try {
    await clearAllData();
    return NextResponse.json({ success: true, message: 'All data cleared successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
