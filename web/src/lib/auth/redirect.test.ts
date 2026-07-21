import assert from 'node:assert/strict';
import test from 'node:test';
import { getInternalRedirectPath } from './redirect.ts';

test('keeps internal redirect paths', () => {
  assert.equal(getInternalRedirectPath('/dashboard?tab=sync#top'), '/dashboard?tab=sync#top');
});

test('rejects external redirect targets', () => {
  assert.equal(getInternalRedirectPath('https://evil.test'), '/dashboard');
  assert.equal(getInternalRedirectPath('//evil.test/path'), '/dashboard');
  assert.equal(getInternalRedirectPath('/\\evil.test/path'), '/dashboard');
});
