import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../supabase/service.ts';
import { decryptSecret } from '../security/encryption.ts';
import { ANGELONE_BROKER, ZERODHA_BROKER, DHAN_BROKER, UPSTOX_BROKER, DELTA_BROKER } from '../brokers/core/types.ts';

export { ANGELONE_BROKER, ZERODHA_BROKER, DHAN_BROKER, UPSTOX_BROKER, DELTA_BROKER };

export interface BrokerConnectionRecord {
  id?: string;
  user_id: string;
  broker: string;
  api_key?: string | null;
  encrypted_api_key?: string | null;
  encrypted_api_secret?: string | null;
  credentials_saved_at?: string | null;
  broker_user_id?: string | null;
  broker_user_name?: string | null;
  encrypted_access_token?: string | null;
  token_expires_at?: string | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  last_sync_cursor?: string | null;
  created_at?: string;
  updated_at?: string;
}

async function getSupabase(): Promise<SupabaseClient> {
  return createServiceClient();
}

export function hasBrokerCredentials(
  connection: BrokerConnectionRecord | null,
): connection is BrokerConnectionRecord & { encrypted_api_secret: string } {
  return Boolean((connection?.encrypted_api_key || connection?.api_key) && connection.encrypted_api_secret);
}

export function getBrokerApiKey(connection: BrokerConnectionRecord): string {
  return connection.encrypted_api_key ? decryptSecret(connection.encrypted_api_key) : connection.api_key || '';
}

export function maskApiKey(apiKey?: string | null) {
  const value = apiKey?.trim() || '';
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export async function fetchBrokerConnection(userId: string, broker = ZERODHA_BROKER): Promise<BrokerConnectionRecord | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('broker', broker)
    .maybeSingle();

  if (error) throw error;
  return data as BrokerConnectionRecord | null;
}

export async function fetchBrokerConnections(userId: string): Promise<BrokerConnectionRecord[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []) as BrokerConnectionRecord[];
}

export async function upsertBrokerConnection(
  userId: string,
  connection: Omit<Partial<BrokerConnectionRecord>, 'id' | 'user_id' | 'broker'>,
  broker = ZERODHA_BROKER,
) {
  const supabase = await getSupabase();
  const payload = {
    ...connection,
    user_id: userId,
    broker,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('broker_connections')
    .upsert(payload, { onConflict: 'user_id,broker' })
    .select()
    .single();

  if (error) throw error;
  return data as BrokerConnectionRecord;
}

export async function saveBrokerCredentials(
  userId: string,
  credentials: Pick<BrokerConnectionRecord, 'encrypted_api_key' | 'encrypted_api_secret'> & Pick<Partial<BrokerConnectionRecord>, 'broker_user_id'>,
  broker = ZERODHA_BROKER,
) {
  const existingConnections = await fetchBrokerConnections(userId);
  const configuredOtherBrokers = existingConnections.filter((connection) => connection.broker !== broker && hasBrokerCredentials(connection));
  if (configuredOtherBrokers.length >= 2) {
    throw new Error('You can connect up to 2 brokers at the same time. Delete one broker connection before adding another.');
  }

  return upsertBrokerConnection(userId, {
    api_key: '',
    encrypted_api_key: credentials.encrypted_api_key,
    encrypted_api_secret: credentials.encrypted_api_secret,
    credentials_saved_at: new Date().toISOString(),
    broker_user_id: credentials.broker_user_id || '',
    broker_user_name: '',
    encrypted_access_token: null,
    token_expires_at: null,
    last_sync_at: null,
    last_sync_status: 'credentials_saved',
    last_sync_error: '',
    last_sync_cursor: '',
  }, broker);
}

export async function disconnectBrokerConnection(userId: string, broker = ZERODHA_BROKER) {
  return upsertBrokerConnection(userId, {
    broker_user_id: '',
    broker_user_name: '',
    encrypted_access_token: null,
    token_expires_at: null,
    last_sync_at: null,
    last_sync_status: 'disconnected',
    last_sync_error: '',
    last_sync_cursor: '',
  }, broker);
}

export async function deleteBrokerCredentials(userId: string, broker = ZERODHA_BROKER) {
  return upsertBrokerConnection(userId, {
    api_key: '',
    encrypted_api_key: null,
    encrypted_api_secret: null,
    credentials_saved_at: null,
    broker_user_id: '',
    broker_user_name: '',
    encrypted_access_token: null,
    token_expires_at: null,
    last_sync_at: null,
    last_sync_status: 'credentials_deleted',
    last_sync_error: '',
    last_sync_cursor: '',
  }, broker);
}

export async function updateBrokerSyncState(
  userId: string,
  syncState: Pick<BrokerConnectionRecord, 'last_sync_at' | 'last_sync_status' | 'last_sync_error'> & Pick<Partial<BrokerConnectionRecord>, 'last_sync_cursor'>,
  broker = ZERODHA_BROKER,
) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('broker_connections')
    .update({ ...syncState, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('broker', broker);

  if (error) throw error;
}
