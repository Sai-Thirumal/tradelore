import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';
import { hasBrokerTokenEncryptionKey } from '../../india/kite/config.ts';

export function isDeltaServerConfigured() {
  return hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv();
}
