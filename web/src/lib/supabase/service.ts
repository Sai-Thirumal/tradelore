import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env.ts';

export function createServiceClient() {
  const url = getSupabaseUrl().trim();
  const key = getSupabaseServiceRoleKey().trim();

  if (!url || !key) {
    throw new Error('Supabase service role environment variables are not configured.');
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
