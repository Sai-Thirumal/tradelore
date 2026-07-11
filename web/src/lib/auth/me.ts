import type { AuthUser } from './session.ts';

interface AuthMeDeps {
  getAuthUser: () => Promise<AuthUser | null>;
  ensureNewUserTrial: (userId: string, userCreatedAt?: string) => Promise<void>;
  logger?: Pick<Console, 'warn'>;
}

function safeErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return /^[A-Za-z0-9_-]{1,64}$/.test(error.code) ? error.code : 'unknown';
  }
  if (error instanceof Error && /^[A-Za-z0-9_-]{1,64}$/.test(error.name)) return error.name;
  return 'unknown';
}

export async function buildAuthMeResponse({
  getAuthUser,
  ensureNewUserTrial,
  logger = console,
}: AuthMeDeps) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  try {
    await ensureNewUserTrial(user.id, user.createdAt);
  } catch (error) {
    logger.warn('billing_trial_initialization_failed', { code: safeErrorCode(error) });
  }

  return Response.json({ user });
}
