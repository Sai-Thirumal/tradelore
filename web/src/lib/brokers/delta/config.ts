import { hasSupabaseServiceRoleEnv } from '@/lib/supabase/env';
import { hasBrokerTokenEncryptionKey } from '@/lib/brokers/zerodha/config';

export function isDeltaServerConfigured() {
  return hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv();
}
