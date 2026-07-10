import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';
import { hasBrokerTokenEncryptionKey } from '../kite/config.ts';

export interface UpstoxConfig {
  redirectUrl: string;
}

export function getUpstoxConfig(origin?: string): UpstoxConfig {
  const redirectUrl = process.env.UPSTOX_REDIRECT_URL || (origin ? `${origin}/api/broker/upstox/callback` : '');
  return { redirectUrl };
}

export function isUpstoxServerConfigured(origin?: string) {
  return Boolean(getUpstoxConfig(origin).redirectUrl && hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv());
}
