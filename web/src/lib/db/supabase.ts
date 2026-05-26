import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function storeOrders(orders: any[]) {
  if (!orders || orders.length === 0) return;
  const { error } = await supabase.from('trade_orders').upsert(orders, { onConflict: 'uid' });
  if (error) throw error;
}

export async function fetchAllOrders() {
  // Fetch all orders with pagination (Supabase default limit is 1000)
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
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
  // Delete all existing
  await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (trades && trades.length > 0) {
    const { error } = await supabase.from('trades').insert(trades);
    if (error) throw error;
  }
}

export async function fetchAllTrades() {
  // Fetch all trades with pagination (Supabase default limit is 1000)
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
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
  await supabase.from('trade_orders').delete().neq('uid', 'INVALID_UID_XYZ');
  await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// ── Playbooks ──
export async function fetchPlaybooks() {
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createPlaybook(playbook: any) {
  const { data, error } = await supabase
    .from('playbooks')
    .insert(playbook)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Daily Journal (pre-market plan) ──
export async function fetchDailyJournal(date: string) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('trade_journal')
    .select('*')
    .eq('trade_id', tradeId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
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
