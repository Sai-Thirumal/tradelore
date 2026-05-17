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
  const { data, error } = await supabase
    .from('trade_orders')
    .select('*')
    .order('trade_time', { ascending: true });
  if (error) throw error;
  return data || [];
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
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('exit_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function clearAllData() {
  await supabase.from('trade_orders').delete().neq('uid', 'INVALID_UID_XYZ');
  await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
