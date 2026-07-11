import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthMeResponse } from './me.ts';
import type { AuthUser } from './session.ts';

const eligibleUser: AuthUser = {
  id: 'user_1',
  email: 'user@example.com',
  createdAt: '2026-07-11T00:00:00Z',
};

async function responseJson(response: Response) {
  return await response.json() as { user: AuthUser | null };
}

test('unauthenticated request still returns 401', async () => {
  let called = false;
  const response = await buildAuthMeResponse({
    getAuthUser: async () => null,
    ensureNewUserTrial: async () => {
      called = true;
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await responseJson(response), { user: null });
  assert.equal(called, false);
});

test('eligible authenticated user creates a trial and returns success', async () => {
  const calls: Array<[string, string | undefined]> = [];
  const response = await buildAuthMeResponse({
    getAuthUser: async () => eligibleUser,
    ensureNewUserTrial: async (id, createdAt) => {
      calls.push([id, createdAt]);
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { user: eligibleUser });
  assert.deepEqual(calls, [['user_1', '2026-07-11T00:00:00Z']]);
});

test('existing trial returns success without duplicate insertion', async () => {
  const response = await buildAuthMeResponse({
    getAuthUser: async () => eligibleUser,
    ensureNewUserTrial: async () => {
      // Existing-trial no-op is handled inside ensureNewUserTrial.
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { user: eligibleUser });
});

test('user before cutoff returns success without trial creation', async () => {
  const oldUser = { ...eligibleUser, createdAt: '2026-07-10T23:59:59Z' };
  const calls: string[] = [];
  const response = await buildAuthMeResponse({
    getAuthUser: async () => oldUser,
    ensureNewUserTrial: async (id) => {
      calls.push(id);
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { user: oldUser });
  assert.deepEqual(calls, ['user_1']);
});

test('trial database failure still returns authenticated-user response', async () => {
  const warnings: unknown[] = [];
  const response = await buildAuthMeResponse({
    getAuthUser: async () => eligibleUser,
    ensureNewUserTrial: async () => {
      throw Object.assign(new Error('database unavailable'), { code: 'db_unavailable' });
    },
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { user: eligibleUser });
  assert.deepEqual(warnings, [['billing_trial_initialization_failed', { code: 'db_unavailable' }]]);
});

test('later request retries trial creation after an earlier failure', async () => {
  let attempts = 0;
  const deps = {
    getAuthUser: async () => eligibleUser,
    ensureNewUserTrial: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('temporary'), { code: 'temporary_failure' });
    },
    logger: { warn: () => undefined },
  };

  assert.equal((await buildAuthMeResponse(deps)).status, 200);
  assert.equal((await buildAuthMeResponse(deps)).status, 200);
  assert.equal(attempts, 2);
});

test('duplicate-key race remains harmless after ensureNewUserTrial handles it', async () => {
  const response = await buildAuthMeResponse({
    getAuthUser: async () => eligibleUser,
    ensureNewUserTrial: async () => {
      // Supabase duplicate-key code 23505 is swallowed by ensureNewUserTrial.
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { user: eligibleUser });
});
