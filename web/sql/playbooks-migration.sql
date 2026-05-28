-- ================================================================
-- TradeLore Playbooks — Expanded Schema Migration
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/unxqubbzwskhesjytyhh/sql/new
-- ================================================================

-- 1. Add new columns to existing playbooks table
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 2. Index on name for listing
CREATE INDEX IF NOT EXISTS idx_playbooks_name ON public.playbooks(name);

-- 3. Seed 3 example playbooks (only if table is empty)
INSERT INTO public.playbooks (name, data, is_default)
SELECT 
  'Opening Range Breakout',
  '{
    "markets": ["Stocks", "Futures"],
    "timeframes": ["5m", "15m"],
    "trading_style": "momentum",
    "market_environment": "trending",
    "best_session": "09:15–10:30 (first 75 min)",
    "macro_invalidation": "FOMC days, major earnings before open",
    "entry_trigger": "Price breaks above/below the opening 15-minute range with volume",
    "entry_confirmation": "Candle closes outside the range, volume > 1.5x average",
    "entry_filters": "No entry if range is too wide (>0.5% of price) or during first 5 min",
    "entry_type": "stop",
    "stop_placement": "Opposite end of the opening range",
    "stop_type": "structure",
    "stop_invalidation": "Price re-enters the range and closes back inside",
    "target_1": "1x range height",
    "target_2": "2x range height",
    "min_rr": "1:2",
    "scale_out": "50% at T1, rest at T2 with trailing",
    "trailing_stop": "Move to breakeven after T1 hit, trail by swing low/high",
    "early_exit_rule": "Volume dries up before reaching T1, reversal candle at range boundary",
    "risk_percent": 1,
    "grade": "A+",
    "grade_a_plus": "Tight range, clear breakout direction, volume confirming, no nearby support/resistance",
    "grade_b": "Wide range, mixed volume, near key levels, choppy price action before breakout",
    "ideal_chart": "",
    "win_rate": 55,
    "avg_rr": 2.3,
    "max_consecutive_losses": 4,
    "failure_conditions": "False breakouts in choppy markets, low volume breakouts, range too wide",
    "psychology_notes": "Don't anticipate the breakout — wait for confirmation. Accept that 45% will fail.",
    "common_mistakes": "Entering on the first poke without confirmation, moving stop too close, taking profit too early",
    "trade_links": []
  }'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE is_default = true);

INSERT INTO public.playbooks (name, data, is_default)
SELECT 
  'VWAP Mean Reversion',
  '{
    "markets": ["Stocks", "Futures"],
    "timeframes": ["5m", "15m"],
    "trading_style": "mean reversion",
    "market_environment": "ranging",
    "best_session": "10:30–14:00 (mid-session)",
    "macro_invalidation": "Trend days where price stays on one side of VWAP all day",
    "entry_trigger": "Price extends beyond 2 standard deviation bands from VWAP",
    "entry_confirmation": "Candle wick rejection at the band + RSI divergence",
    "entry_filters": "No entry if trend is strong (3+ consecutive candles away from VWAP), avoid news-driven moves",
    "entry_type": "limit",
    "stop_placement": "Beyond the extreme wick of the entry candle",
    "stop_type": "structure",
    "stop_invalidation": "Price closes beyond 3rd deviation band",
    "target_1": "VWAP midline",
    "target_2": "1st deviation band (opposite side)",
    "min_rr": "1:1.5",
    "scale_out": "Full exit at T1",
    "trailing_stop": "Not used — mean reversion moves are fast",
    "early_exit_rule": "Momentum continues against position, volume spike in wrong direction",
    "risk_percent": 0.5,
    "grade": "B",
    "grade_a_plus": "Clean extension to 2nd band with wick, low volume drift, RSI < 25 or > 75",
    "grade_b": "Extension to 1.5 bands only, mixed volume, weak RSI signal",
    "ideal_chart": "",
    "win_rate": 65,
    "avg_rr": 1.6,
    "max_consecutive_losses": 3,
    "failure_conditions": "Trend days, news events causing sustained directional moves, low liquidity stocks",
    "psychology_notes": "This setup requires going against momentum — can be uncomfortable. Size down.",
    "common_mistakes": "Catching a falling knife, entering too early before confirmation, not respecting trend days",
    "trade_links": []
  }'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE is_default = true AND name = 'VWAP Mean Reversion');

INSERT INTO public.playbooks (name, data, is_default)
SELECT 
  'Trend Continuation Pullback',
  '{
    "markets": ["Stocks", "Indices", "Options", "Futures"],
    "timeframes": ["1h", "4h", "daily"],
    "trading_style": "trend following",
    "market_environment": "trending",
    "best_session": "Any — setup is timeframe-based, not time-of-day",
    "macro_invalidation": "Major trend reversal signals, key support/resistance breaks on higher timeframe",
    "entry_trigger": "Price pulls back to 20 EMA or previous support/resistance in a trending market",
    "entry_confirmation": "Bullish/bearish engulfing or pin bar at the level, RSI > 50 (uptrend) or < 50 (downtrend)",
    "entry_filters": "No entry if pullback is too deep (beyond 50% of the prior leg), low volume pullback ideal",
    "entry_type": "limit",
    "stop_placement": "Below/above the pullback low/high",
    "stop_type": "structure",
    "stop_invalidation": "Close beyond the 50% retracement level",
    "target_1": "Previous swing high/low",
    "target_2": "127% Fibonacci extension",
    "min_rr": "1:2",
    "scale_out": "70% at T1, 30% at T2",
    "trailing_stop": "Trail by 20 EMA after T1 reached",
    "early_exit_rule": "Break of trendline, momentum divergence on higher timeframe",
    "risk_percent": 1.5,
    "grade": "A+",
    "grade_a_plus": "Clean trend, shallow pullback to EMA + previous S/R confluence, bullish engulfing, volume confirming",
    "grade_b": "Steep pullback near 50%, no clear confluence, weaker candle pattern",
    "ideal_chart": "",
    "win_rate": 50,
    "avg_rr": 2.8,
    "max_consecutive_losses": 5,
    "failure_conditions": "Trend exhaustion, choppy pullbacks with overlapping candles, low timeframe noise",
    "psychology_notes": "Patience is key — wait for the pullback to complete. Don't chase breakouts.",
    "common_mistakes": "Entering too early before the pullback finishes, ignoring higher timeframe resistance, oversized in a B-grade setup",
    "trade_links": []
  }'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE is_default = true AND name = 'Trend Continuation Pullback');
