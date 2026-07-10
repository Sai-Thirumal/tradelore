import { hasSupabaseServiceRoleEnv } from '../../../supabase/env.ts';

export interface ZerodhaConfig {
  redirectUrl: string;
}

export function getZerodhaConfig(origin?: string): ZerodhaConfig {
  const configuredRedirect = process.env.ZERODHA_REDIRECT_URL || process.env.KITE_REDIRECT_URL || '';
  const redirectUrl = configuredRedirect || (origin ? `${origin}/api/broker/zerodha/callback` : '');

  return { redirectUrl };
}

export function isZerodhaServerConfigured(origin?: string) {
  const config = getZerodhaConfig(origin);
  return Boolean(config.redirectUrl && hasBrokerTokenEncryptionKey() && hasSupabaseServiceRoleEnv());
}

export function hasBrokerTokenEncryptionKey() {
  return Boolean(process.env.BROKER_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY);
}
