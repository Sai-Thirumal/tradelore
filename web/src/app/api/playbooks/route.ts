import { NextRequest, NextResponse } from 'next/server';
import { fetchPlaybooks, fetchPlaybook, createPlaybook, updatePlaybook, deletePlaybook } from '@/lib/db/supabase';
import { requireAuthUser } from '@/lib/auth/session';
import { errorMessageIncludes, hasErrorCode, internalErrorResponse } from '@/lib/errors';
import { validateCreatePlaybookPayload, validateUpdatePlaybookPayload } from '@/lib/validation/playbooks';
import { readJsonObject, validationErrorResponse } from '@/lib/validation/request';

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
    return internalErrorResponse(error, 'Unable to load playbooks.');
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = validateCreatePlaybookPayload(await readJsonObject(request));
    const playbook = await createPlaybook(body, user.id);
    return NextResponse.json(playbook, { status: 201 });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return internalErrorResponse(error, 'Unable to create playbook.');
  }
}

export async function PUT(request: Request) {
  try {
    const { user, response } = await requireAuthUser();
    if (response) return response;

    const body = validateUpdatePlaybookPayload(await readJsonObject(request));
    const { id, ...updates } = body;
    const playbook = await updatePlaybook(id, updates, user.id);
    return NextResponse.json(playbook);
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return internalErrorResponse(error, 'Unable to update playbook.');
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
    return internalErrorResponse(error, 'Unable to delete playbook.');
  }
}
