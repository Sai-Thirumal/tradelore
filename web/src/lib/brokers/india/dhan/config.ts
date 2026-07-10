import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';
import { hasBrokerTokenEncryptionKey } from '../kite/config.ts';

export function isDhanServerConfigured() {
  return hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv();
}
