import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  let key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '').replace(/\\n/g, '');
  env[key] = val;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url);

const supabase = createClient(url, key);

const sql = `
-- Playbooks table
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria TEXT,
  entry_rules TEXT,
  exit_rules TEXT,
  position_sizing TEXT,
  rating INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trade journal table (per-trade analysis)
CREATE TABLE IF NOT EXISTS public.trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT NOT NULL UNIQUE,
  risk_amount NUMERIC,
  profit_target_entry NUMERIC,
  profit_target_exit NUMERIC,
  position_sizing TEXT,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE SET NULL,
  what_worked TEXT,
  what_didnt TEXT,
  lessons_learned TEXT,
  emotions TEXT,
  important_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily journal table (pre-market plan)
CREATE TABLE IF NOT EXISTS public.daily_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL UNIQUE,
  market_outlook TEXT,
  outlook_bias TEXT,
  capital_to_deploy NUMERIC,
  playbooks_planned TEXT,
  key_levels TEXT,
  news_events TEXT,
  pre_market_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow all operations with service role
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_journal ENABLE ROW LEVEL SECURITY;

-- Allow anon key read access
CREATE POLICY IF NOT EXISTS "Allow all" ON public.playbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON public.trade_journal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON public.daily_journal FOR ALL USING (true) WITH CHECK (true);

-- Insert some default playbooks
INSERT INTO public.playbooks (name, description, entry_rules, exit_rules, rating)
VALUES 
  ('Trend Following', 'Enter on pullbacks in established trends. Use 20 EMA as dynamic support/resistance.', 'Price above 20 EMA, pullback to EMA, bullish candle confirmation', 'Trail stop at swing low, take profit at 2R', 4),
  ('Mean Reversion', 'Buy oversold, sell overbought using RSI and Bollinger Bands.', 'RSI < 30 or price at lower BB, reversal candle', 'Exit at middle BB or RSI 50', 3),
  ('Breakout Trading', 'Enter on break of key support/resistance with volume confirmation.', 'Price breaks pivot high/low, volume > 1.5x average', 'Stop below breakout level, target measured move', 4),
  ('Options Selling', 'Sell OTM options with 15-20 DTE, manage at 50% profit or 2x stop.', 'IV rank > 50, 15-20 DTE, delta < 0.30', 'Take profit at 50% credit, stop at 2x credit received', 3),
  ('Gap Trading', 'Trade the gap fill or gap continuation on opening.', 'Gap > 1% from previous close, wait for first 15-min candle', 'Target gap fill level or previous close', 2)
ON CONFLICT DO NOTHING;
`;

async function main() {
  try {
    // Try using the SQL endpoint via rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql }).single();
    
    if (error) {
      console.log('RPC approach failed, trying direct SQL...');
      // Fallback: try creating tables one by one via raw SQL
      // Supabase JS v2 has no direct .sql() - let's try a different approach
      console.log('Error:', error.message);
      
      // Let's try using the REST API to create tables via the management plane
      // For now, let's at least verify we can insert into what we need
    }
    
    if (data) {
      console.log('SQL executed successfully:', data);
    }
  } catch (err) {
    console.error('Error:', err.message);
    
    // Try creating via the management API
    console.log('\nTrying management API...');
  }
}

main();
