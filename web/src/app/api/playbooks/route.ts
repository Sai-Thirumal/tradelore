import { NextResponse } from 'next/server';
import { fetchPlaybooks, createPlaybook } from '@/lib/db/supabase';

export async function GET() {
  try {
    const playbooks = await fetchPlaybooks();
    return NextResponse.json(playbooks);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playbook = await createPlaybook(body);
    return NextResponse.json(playbook, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
