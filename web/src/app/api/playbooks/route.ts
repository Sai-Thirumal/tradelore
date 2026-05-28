import { NextRequest, NextResponse } from 'next/server';
import { fetchPlaybooks, fetchPlaybook, createPlaybook, updatePlaybook, deletePlaybook } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const playbook = await fetchPlaybook(id);
      return NextResponse.json(playbook);
    }
    const playbooks = await fetchPlaybooks();
    return NextResponse.json(playbooks);
  } catch (error: any) {
    // Handle missing table gracefully for preview deploys
    if (error?.message?.includes('relation') || error?.code === '42P01') {
      return NextResponse.json([]);
    }
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const playbook = await updatePlaybook(id, updates);
    return NextResponse.json(playbook);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await deletePlaybook(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
