import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeltaFundingTransaction } from '@/lib/brokers/delta/funding';
import { latestTradeMonths, tradeMonth } from '@/lib/engine/trade-retention';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import type { JsonRecord, PlaybookRecord, TradeJournalRecord, TradeOrder, TradeRecord } from '@/lib/types/trading';

async function getSupabase(): Promise<SupabaseClient | null> {
  try {
    return await createServerSupabaseClient();
  } catch {
    return null;
  }
}

function withUserId<T extends object>(row: T, userId: string): T & { user_id: string } {
  return { ...row, user_id: userId };
}

function scopedOrderUid(uid: string, userId: string) {
  return uid.startsWith(`${userId}_`) ? uid : `${userId}_${uid}`;
}

export async function storeOrders(orders: TradeOrder[], userId: string) {
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

export async function fetchAllOrders(userId: string): Promise<TradeOrder[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: TradeOrder[] = [];
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

    allData = allData.concat(data as TradeOrder[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

export async function retainLatestTradeMonths(userId: string): Promise<TradeOrder[]> {
  const supabase = await getSupabase();
  const allOrders = await fetchAllOrders(userId);
  if (!supabase || allOrders.length === 0) return allOrders;

  const retainedMonths = latestTradeMonths(allOrders);
  const retainedOrders = allOrders.filter(order => retainedMonths.has(tradeMonth(order)));
  const staleUids = allOrders
    .filter(order => !retainedMonths.has(tradeMonth(order)))
    .map(order => order.uid);

  for (let i = 0; i < staleUids.length; i += 1000) {
    const { error } = await supabase
      .from('trade_orders')
      .delete()
      .eq('user_id', userId)
      .in('uid', staleUids.slice(i, i + 1000));
    if (error) throw error;
  }

  return retainedOrders;
}

export async function replaceTrades(trades: TradeRecord[], userId: string) {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from('trades').delete().eq('user_id', userId);
  if (trades && trades.length > 0) {
    const scopedTrades = trades.map(trade => withUserId(trade, userId));
    const { error } = await supabase.from('trades').insert(scopedTrades);
    if (error) throw error;
  }
}

export async function storeDeltaFundingTransactions(transactions: DeltaFundingTransaction[], userId: string) {
  const supabase = await getSupabase();
  if (!supabase || transactions.length === 0) return;
  const rows = transactions.map((transaction) => ({
    ...transaction,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('delta_wallet_transactions')
    .upsert(rows, { onConflict: 'user_id,external_transaction_id' });
  if (error) throw error;
}

export async function fetchDeltaFundingTransactions(userId: string): Promise<DeltaFundingTransaction[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: DeltaFundingTransaction[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('delta_wallet_transactions')
      .select('external_transaction_id, transaction_type, amount, asset, product_id, product_symbol, occurred_at, raw')
      .eq('user_id', userId)
      .eq('transaction_type', 'funding')
      .order('occurred_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat((data as DeltaFundingTransaction[]).map((row) => ({
      ...row,
      amount: Number(row.amount || 0),
      product_id: row.product_id ? Number(row.product_id) : undefined,
    })));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

export async function fetchAllTrades(userId: string): Promise<TradeRecord[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: TradeRecord[] = [];
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

    allData = allData.concat(data as TradeRecord[]);
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
  await supabase.from('delta_wallet_transactions').delete().eq('user_id', userId);
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

  const clones = (defaults as PlaybookRecord[]).map((playbook) => ({
    user_id: userId,
    name: playbook.name,
    data: playbook.data || {},
    is_default: true,
  }));

  const { error: insertError } = await supabase.from('playbooks').insert(clones);
  if (insertError) throw insertError;
}

export async function fetchPlaybooks(userId: string): Promise<PlaybookRecord[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  await ensureUserPlaybooks(userId);
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return (data || []) as PlaybookRecord[];
}

export async function fetchPlaybook(id: string, userId: string): Promise<PlaybookRecord | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data as PlaybookRecord;
}

export async function createPlaybook(playbook: { name: string; data?: JsonRecord }, userId: string) {
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

export async function updatePlaybook(id: string, updates: { name?: string; data?: JsonRecord }, userId: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const payload: { updated_at: string; name?: string; data?: JsonRecord } = { updated_at: new Date().toISOString() };
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

export async function fetchAllTradeJournals(userId: string): Promise<TradeJournalRecord[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  let allData: TradeJournalRecord[] = [];
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
    allData = allData.concat(data as TradeJournalRecord[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function saveTradeJournal(entry: TradeJournalRecord, userId: string) {
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
