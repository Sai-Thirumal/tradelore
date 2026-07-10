import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';
import { hasBrokerTokenEncryptionKey } from '../kite/config.ts';

export function isDhanServerConfigured() {
  return hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv();
}

export function getDhanConfig(origin?: string) {
  return {
    redirectUrl: process.env.DHAN_REDIRECT_URL || (origin ? `${origin}/api/broker/dhan/callback` : ''),
  };
}
