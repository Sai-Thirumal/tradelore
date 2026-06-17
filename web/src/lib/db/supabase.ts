import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

async function getSupabase(): Promise<SupabaseClient | null> {
  try {
    return await createServerSupabaseClient();
  } catch {
    return null;
  }
}

function withUserId<T extends Record<string, any>>(row: T, userId: string): T & { user_id: string } {
  return { ...row, user_id: userId };
}

function scopedOrderUid(uid: string, userId: string) {
  return uid.startsWith(`${userId}_`) ? uid : `${userId}_${uid}`;
}

export async function storeOrders(orders: any[], userId: string) {
  const supabase = await getSupabase();
  if (!supabase || !orders || orders.length === 0) return;
  const scopedOrders = orders.map(order => ({
    ...order,
    uid: scopedOrderUid(order.uid, userId),
    user_id: userId,
  }));
  const { error } = await supabase.from('trade_orders').upsert(scopedOrders, { onConflict: 'uid' });
  if (error) throw error;
}

export async function fetchAllOrders(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('trade_orders')
      .select('*')
      .eq('user_id', userId)
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

export async function replaceTrades(trades: any[], userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from('trades').delete().eq('user_id', userId);
  if (trades && trades.length > 0) {
    const scopedTrades = trades.map(trade => withUserId(trade, userId));
    const { error } = await supabase.from('trades').insert(scopedTrades);
    if (error) throw error;
  }
}

export async function fetchAllTrades(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
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

export async function clearAllData(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from('trade_orders').delete().eq('user_id', userId);
  await supabase.from('trades').delete().eq('user_id', userId);
  await supabase.from('trade_journal').delete().eq('user_id', userId);
  await supabase.from('daily_journal').delete().eq('user_id', userId);
}

// ── Playbooks ──
async function ensureUserPlaybooks(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { count, error: countError } = await supabase
    .from('playbooks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count || 0) > 0) return;

  const { data: defaults, error: defaultsError } = await supabase
    .from('playbooks')
    .select('name, data, is_default')
    .is('user_id', null)
    .eq('is_default', true)
    .order('name');

  if (defaultsError) throw defaultsError;
  if (!defaults || defaults.length === 0) return;

  const clones = defaults.map((playbook: any) => ({
    user_id: userId,
    name: playbook.name,
    data: playbook.data || {},
    is_default: true,
  }));

  const { error: insertError } = await supabase.from('playbooks').insert(clones);
  if (insertError) throw insertError;
}

export async function fetchPlaybooks(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return [];
  await ensureUserPlaybooks(userId);
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchPlaybook(id: string, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function createPlaybook(playbook: { name: string; data?: Record<string, any> }, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const { data, error } = await supabase
    .from('playbooks')
    .insert({
      user_id: userId,
      name: playbook.name,
      data: playbook.data || {},
      is_default: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlaybook(id: string, updates: { name?: string; data?: Record<string, any> }, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.data !== undefined) payload.data = updates.data;
  const { data, error } = await supabase
    .from('playbooks')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlaybook(id: string, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const { error } = await supabase
    .from('playbooks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Daily Journal (pre-market plan) ──
export async function fetchDailyJournal(date: string, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('daily_journal')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDailyJournal(entry: {
  date: string;
  market_outlook?: string;
  outlook_bias?: string;
  capital_to_deploy?: number | null;
  playbooks_planned?: string;
  key_levels?: string;
  news_events?: string;
  pre_market_notes?: string;
}, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const { data, error } = await supabase
    .from('daily_journal')
    .upsert(
      { ...entry, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Trade Journal (per-trade post-market analysis) ──
export async function fetchTradeJournal(tradeId: string, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('trade_journal')
    .select('*')
    .eq('user_id', userId)
    .eq('trade_id', tradeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllTradeJournals(userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('trade_journal')
      .select('*')
      .eq('user_id', userId)
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
  risk_amount?: number | null;
  profit_target_entry?: number | null;
  profit_target_exit?: number | null;
  position_sizing?: string;
  playbook_id?: string;
  what_worked?: string;
  what_didnt?: string;
  lessons_learned?: string;
  emotions?: string;
  important_notes?: string;
}, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const { data, error } = await supabase
    .from('trade_journal')
    .upsert(
      { ...entry, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,trade_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
