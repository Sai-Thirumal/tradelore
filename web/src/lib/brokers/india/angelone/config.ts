import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';
import { hasBrokerTokenEncryptionKey } from '../kite/config.ts';

export function isAngelOneServerConfigured() {
  return hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv();
}
