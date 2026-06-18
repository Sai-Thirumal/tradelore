import { NextRequest, NextResponse } from 'next/server';
import { fetchPlaybooks, fetchPlaybook, createPlaybook, updatePlaybook, deletePlaybook } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';
import { errorMessageIncludes, getErrorMessage, hasErrorCode } from '@/lib/errors';
import type { JsonRecord } from '@/lib/types/trading';

interface PlaybookPayload {
  id?: string;
  name: string;
  data?: JsonRecord;
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const playbook = await fetchPlaybook(id, user.id);
      return NextResponse.json(playbook);
    }
    const playbooks = await fetchPlaybooks(user.id);
    return NextResponse.json(playbooks);
  } catch (error: unknown) {
    // Handle missing table gracefully for preview deploys
    if (errorMessageIncludes(error, 'relation') || hasErrorCode(error, '42P01')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = await request.json() as PlaybookPayload;
    const playbook = await createPlaybook(body, user.id);
    return NextResponse.json(playbook, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = await request.json() as PlaybookPayload;
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const playbook = await updatePlaybook(id, updates, user.id);
    return NextResponse.json(playbook);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await deletePlaybook(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
