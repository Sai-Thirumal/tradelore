import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded client — returns null on preview deploys where Supabase env vars are
// production-scoped. Every function below guards against null with a silent fallback.
function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const _supabase = getSupabase();

export async function storeOrders(orders: any[]) {
  if (!_supabase || !orders || orders.length === 0) return;
  const { error } = await _supabase.from('trade_orders').upsert(orders, { onConflict: 'uid' });
  if (error) throw error;
}

export async function fetchAllOrders() {
  if (!_supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await _supabase
      .from('trade_orders')
      .select('*')
      .order('trade_time', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

export async function replaceTrades(trades: any[]) {
  if (!_supabase) return;
  await _supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (trades && trades.length > 0) {
    const { error } = await _supabase.from('trades').insert(trades);
    if (error) throw error;
  }
}

export async function fetchAllTrades() {
  if (!_supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await _supabase
      .from('trades')
      .select('*')
      .order('exit_time', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

export async function clearAllData() {
  if (!_supabase) return;
  await _supabase.from('trade_orders').delete().neq('uid', 'INVALID_UID_XYZ');
  await _supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// ── Playbooks ──
export async function fetchPlaybooks() {
  if (!_supabase) return [];
  const { data, error } = await _supabase
    .from('playbooks')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchPlaybook(id: string) {
  if (!_supabase) return null;
  const { data, error } = await _supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPlaybook(playbook: { name: string; data?: Record<string, any> }) {
  if (!_supabase) throw new Error('Supabase not available');
  const { data, error } = await _supabase
    .from('playbooks')
    .insert({
      name: playbook.name,
      data: playbook.data || {},
      is_default: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlaybook(id: string, updates: { name?: string; data?: Record<string, any> }) {
  if (!_supabase) throw new Error('Supabase not available');
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.data !== undefined) payload.data = updates.data;
  const { data, error } = await _supabase
    .from('playbooks')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlaybook(id: string) {
  if (!_supabase) throw new Error('Supabase not available');
  const { error } = await _supabase
    .from('playbooks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Daily Journal (pre-market plan) ──
export async function fetchDailyJournal(date: string) {
  if (!_supabase) return null;
  const { data, error } = await _supabase
    .from('daily_journal')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDailyJournal(entry: {
  date: string;
  market_outlook?: string;
  outlook_bias?: string;
  capital_to_deploy?: number;
  playbooks_planned?: string;
  key_levels?: string;
  news_events?: string;
  pre_market_notes?: string;
}) {
  if (!_supabase) throw new Error('Supabase not available');
  const { data, error } = await _supabase
    .from('daily_journal')
    .upsert(
      { ...entry, updated_at: new Date().toISOString() },
      { onConflict: 'date' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Trade Journal (per-trade post-market analysis) ──
export async function fetchTradeJournal(tradeId: string) {
  if (!_supabase) return null;
  const { data, error } = await _supabase
    .from('trade_journal')
    .select('*')
    .eq('trade_id', tradeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllTradeJournals() {
  if (!_supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await _supabase
      .from('trade_journal')
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function saveTradeJournal(entry: {
  trade_id: string;
  risk_amount?: number;
  profit_target_entry?: number;
  profit_target_exit?: number;
  position_sizing?: string;
  playbook_id?: string;
  what_worked?: string;
  what_didnt?: string;
  lessons_learned?: string;
  emotions?: string;
  important_notes?: string;
}) {
  if (!_supabase) throw new Error('Supabase not available');
  const { data, error } = await _supabase
    .from('trade_journal')
    .upsert(
      { ...entry, updated_at: new Date().toISOString() },
      { onConflict: 'trade_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
