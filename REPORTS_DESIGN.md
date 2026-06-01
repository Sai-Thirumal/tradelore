# TradeLore Reports & Analytics — Design Spec

## 1. Goal
Give the trader a complete, Indian-market-oriented analytics dashboard that turns their broker CSV + journal entries into actionable insights. No guesswork. Every metric must be computed from real data.

---

## 2. What We Already Have (Current Data Assets)

| Source | Fields |
|--------|--------|
| `trades` | symbol, exchange, segment (FO/EQ), expiry_date, direction, qty, avg_entry, avg_exit, pnl, entry_time, exit_time, trade_date, result, orders |
| `trade_journal` | risk_amount, profit_target_entry/exit, position_sizing, playbook_id, emotions, what_worked/what_didnt/lessons_learned |
| `daily_journal` | date, outlook_bias, capital_to_deploy, playbooks_planned |
| `playbooks` | name, data (JSON with timeframes, markets, trading_style, etc.) |

---

## 3. New Data We Need to Capture / Derive

### 3.1 Computed columns (no schema change — compute in engine)
- `trade_duration_minutes` — from entry_time to exit_time
- `is_intraday` — true if entry and exit on same calendar date AND duration < 1 day
- `r_multiple` — pnl / risk_amount (only where risk_amount > 0)
- `pnl_pct` — (pnl / (avg_entry * qty)) * 100  (for directional P&L %)
- `target_efficiency` — actual_pnl / planned_risk * planned_RR (how close to plan)

### 3.2 New table: `trade_tags`
Allow users to tag trades with custom labels beyond playbook.
```sql
CREATE TABLE trade_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, tag)
);
CREATE INDEX idx_trade_tags_trade_id ON trade_tags(trade_id);
CREATE INDEX idx_trade_tags_tag ON trade_tags(tag);
```

### 3.3 New table: `capital_snapshots`
Track daily capital for accurate drawdown and ROI.
```sql
CREATE TABLE capital_snapshots (
  date DATE PRIMARY KEY,
  opening_capital NUMERIC NOT NULL,
  closing_capital NUMERIC,
  deployed_capital NUMERIC DEFAULT 0,  -- max intraday exposure
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Backend Formula Engine (`lib/compute/analytics.ts`)

Every formula here is standard in professional trading analytics. No approximations.

### 4.1 Core Performance Metrics

```typescript
// Gross P&L = sum of all trade pnl
const grossPnl = trades.reduce((s, t) => s + t.pnl, 0);

// Net P&L after estimated charges (Indian market)
// Flat estimate: ₹20 per order leg for discount brokers
const estimatedCharges = trades.reduce((s, t) => {
  const legs = t.orders?.length || 2;
  return s + (legs * 20);  // ₹20 per executed order
}, 0);
const netPnl = grossPnl - estimatedCharges;

// Win / Loss counts
const wins = trades.filter(t => t.result === 'win');
const losses = trades.filter(t => t.result === 'loss');
const breakeven = trades.filter(t => t.result === 'breakeven');

// Win Rate (trade-level)
const tradeWinRate = (wins.length / (wins.length + losses.length)) * 100;

// Profit Factor = Gross Wins / Gross Losses
const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? Infinity : 0);

// Avg Win / Avg Loss
const avgWin = wins.length > 0 ? grossWins / wins.length : 0;
const avgLoss = losses.length > 0 ? grossLosses / losses.length : 0;

// Win/Loss Ratio (Payoff Ratio)
const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

// Expectancy per trade (in ₹)
// E = (WinRate * AvgWin) - (LossRate * AvgLoss)
const winRateDecimal = wins.length / trades.length;
const lossRateDecimal = losses.length / trades.length;
const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);

// Expectancy % (as % of avg risk)
const avgRisk = trades
  .filter(t => t.risk_amount > 0)
  .reduce((s, t) => s + t.risk_amount, 0) / trades.filter(t => t.risk_amount > 0).length || 1;
const expectancyPct = (expectancy / avgRisk) * 100;
```

### 4.2 R-Multiple Analytics

```typescript
// Only for trades where user logged risk_amount
const rTrades = trades.filter(t => t.risk_amount > 0).map(t => ({
  ...t,
  r: t.pnl / t.risk_amount,
}));

const avgR = rTrades.reduce((s, t) => s + t.r, 0) / rTrades.length;
const maxR = Math.max(...rTrades.map(t => t.r));
const minR = Math.min(...rTrades.map(t => t.r));
const medianR = median(rTrades.map(t => t.r));

// R-distribution buckets
const rBuckets = {
  'less_than_minus1': rTrades.filter(t => t.r < -1).length,
  'minus1_to_0': rTrades.filter(t => t.r >= -1 && t.r < 0).length,
  '0_to_1': rTrades.filter(t => t.r >= 0 && t.r < 1).length,
  '1_to_2': rTrades.filter(t => t.r >= 1 && t.r < 2).length,
  '2_to_3': rTrades.filter(t => t.r >= 2 && t.r < 3).length,
  '3_plus': rTrades.filter(t => t.r >= 3).length,
};
```

### 4.3 Drawdown & Equity Curve

```typescript
// Daily P&L array (sorted by date)
const dailyPnl: { date: string; pnl: number }[] = /* from existing computeStats */;

// Cumulative equity assuming starting capital
const startingCapital = 100000;  // or from capital_snapshots
let equity = startingCapital;
const equityCurve = dailyPnl.map(d => {
  equity += d.pnl;
  return { date: d.date, equity };
});

// Peak equity and drawdown at each point
let peak = startingCapital;
const drawdowns = equityCurve.map(({ date, equity }) => {
  if (equity > peak) peak = equity;
  const dd = peak - equity;  // absolute drawdown
  const ddPct = (dd / peak) * 100;
  return { date, equity, peak, drawdown: dd, drawdownPct: ddPct };
});

const maxDrawdown = Math.max(...drawdowns.map(d => d.drawdown));
const maxDrawdownPct = Math.max(...drawdowns.map(d => d.drawdownPct));
const maxDrawdownDate = drawdowns.find(d => d.drawdown === maxDrawdown)?.date;
const recoveryDays = /* days from max DD date to new peak */;
```

### 4.4 Session Analysis (Indian Market Time)

Indian equity markets: 09:15 to 15:30 IST.

```typescript
function getSession(timeStr: string): string {
  const hour = new Date(timeStr.replace(' ', 'T')).getHours();
  const minute = new Date(timeStr.replace(' ', 'T')).getMinutes();
  const totalMinutes = hour * 60 + minute;
  // 09:15 = 555 minutes from midnight
  if (totalMinutes < 600) return 'Opening (9:15–10:00)';
  if (totalMinutes < 720) return 'Morning (10:00–12:00)';
  if (totalMinutes < 840) return 'Afternoon (12:00–14:00)';
  return 'Closing (14:00–15:30)';
}

// Group trades by session and compute stats per bucket
```

### 4.5 Day-of-Week Analysis

```typescript
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const byDayOfWeek = groupBy(trades, t => {
  return dayNames[new Date(t.trade_date + 'T00:00:00').getDay()];
});
// For each day: trade count, win rate, avg pnl, total pnl
```

### 4.6 Segment & Symbol Analysis

```typescript
// By segment: EQ vs FO
const bySegment = groupBy(trades, t => t.segment || 'EQ');

// By symbol (top 10 by trade count, or all)
const bySymbol = groupBy(trades, t => t.symbol);
// For each: total_trades, win_rate, total_pnl, avg_pnl, max_winner, max_loser
```

### 4.7 Duration Analysis

```typescript
const durations = trades.map(t => {
  const entry = new Date(t.entry_time.replace(' ', 'T'));
  const exit = new Date(t.exit_time.replace(' ', 'T'));
  return (exit.getTime() - entry.getTime()) / 1000 / 60; // minutes
});

const avgDurationMinutes = average(durations);
const medianDuration = median(durations);

// Buckets
const durationBuckets = {
  'under_5min': durations.filter(d => d < 5).length,
  '5_to_15min': durations.filter(d => d >= 5 && d < 15).length,
  '15_to_30min': durations.filter(d => d >= 15 && d < 30).length,
  '30_to_60min': durations.filter(d => d >= 30 && d < 60).length,
  'over_1hour': durations.filter(d => d >= 60).length,
};
```

### 4.8 Behavioral Analytics (from Journal)

```typescript
// Emotion frequency
const emotionCounts: Record<string, number> = {};
for (const j of journals) {
  for (const em of (j.emotions || '').split(',').filter(Boolean)) {
    emotionCounts[em] = (emotionCounts[em] || 0) + 1;
  }
}

// Emotion performance: avg P&L when feeling X vs feeling Y
const emotionPerformance: Record<string, { trades: number; avgPnl: number; winRate: number }> = {};
for (const em of Object.keys(emotionCounts)) {
  const tagged = trades.filter(t => {
    const j = journalMap[getTradeId(t)];
    return j?.emotions?.includes(em);
  });
  emotionPerformance[em] = {
    trades: tagged.length,
    avgPnl: avg(tagged.map(t => t.pnl)),
    winRate: winRate(tagged),
  };
}

// Playbook performance (already exists — extend with R-multiple)
```

### 4.9 Capital Efficiency (Indian Context)

```typescript
// ROI on deployed capital
const roi = (netPnl / averageDeployedCapital) * 100;

// Return on Opening Capital
const roc = (netPnl / startingCapital) * 100;

// Average return per day (trading days only)
const tradingDays = new Set(trades.map(t => t.trade_date)).size;
const avgDailyReturn = netPnl / tradingDays;

// Annualized return (if we assume ~250 trading days/year)
const daysActive = tradingDays;
const annualizedReturn = ((startingCapital + netPnl) / startingCapital) ** (250 / daysActive) - 1;

// Sharpe-like ratio (simplified, using daily P&L)
const dailyReturns = dailyPnl.map(d => d.pnl / startingCapital);
const avgDailyReturnPct = average(dailyReturns);
const dailyStdDev = standardDeviation(dailyReturns);
const sharpeLike = dailyStdDev > 0 ? (avgDailyReturnPct / dailyStdDev) * Math.sqrt(250) : 0;
```

### 4.10 Streak Analysis

```typescript
// Build streak array
const streaks = [];
let currentStreak = 0;
let currentType = '';
for (const t of tradesSortedByExitTime) {
  if (t.result === 'win') {
    if (currentType === 'win') currentStreak++;
    else {
      if (currentType) streaks.push({ type: currentType, count: currentStreak });
      currentType = 'win';
      currentStreak = 1;
    }
  } else if (t.result === 'loss') {
    if (currentType === 'loss') currentStreak++;
    else {
      if (currentType) streaks.push({ type: currentType, count: currentStreak });
      currentType = 'loss';
      currentStreak = 1;
    }
  }
}
if (currentType) streaks.push({ type: currentType, count: currentStreak });

const maxWinStreak = Math.max(...streaks.filter(s => s.type === 'win').map(s => s.count), 0);
const maxLossStreak = Math.max(...streaks.filter(s => s.type === 'loss').map(s => s.count), 0);
const currentStreakType = streaks.length > 0 ? streaks[streaks.length - 1].type : '';
const currentStreakCount = streaks.length > 0 ? streaks[streaks.length - 1].count : 0;
```

---

## 5. UI Workflow & Navigation

### 5.1 New Nav Tab: "Reports" (or rename to "Analytics")
Add alongside Dashboard | Journal | Trade Log | Playbooks.

### 5.2 Reports Page Layout
```
┌────────────────────────────────────────────────────────────┐
│  Date Range Picker  [Last 30 Days ▼]   Capital: ₹1,00,000  │
├────────────────────────────────────────────────────────────┤
│  OVERVIEW  |  PERFORMANCE  |  BEHAVIOR  |  BREAKDOWNS      │
│  (sub-nav inside Reports)                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [CONTENT AREA — see sections below]                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Tab 1: Overview (The "At a Glance" Dashboard)

**Top KPI Row** (6 stat pills):
1. **Net P&L** — `+₹24,500` (with green/red)
2. **Win Rate** — `52%` (42W / 39L)
3. **Profit Factor** — `1.42`
4. **Expectancy** — `+₹312 / trade` or `+0.3R`
5. **Max Drawdown** — `−₹8,200 (−8.2%)`
6. **Total Trades** — `81`

**Second Row** (4 smaller pills):
- Avg Win: `+₹1,240` | Avg Loss: `−₹892` | Ratio: `1.39`
- Green Days / Red Days: `18 / 12`
- Day Win %: `60%`
- Charges Estimate: `−₹1,620`

**Charts Row 1:**
- Left: **Cumulative P&L Curve** (line chart, area fill) — lightweight-charts
- Right: **Daily P&L Bars** — green/red bars per day

**Charts Row 2:**
- Left: **Win/Loss Distribution** — horizontal bar of trade counts by bucket
- Right: **R-Multiple Distribution** — bar chart of R buckets

### 5.4 Tab 2: Performance (Deep Metrics)

**Section: Returns & Drawdowns**
- Max Drawdown: `₹8,200` with date range
- Longest Recovery: `6 trading days`
- Current Drawdown from Peak: `₹1,200 (1.2%)`
- Equity curve (full width, taller)

**Section: Trade Duration**
- Avg Hold Time: `14 min`
- Median Hold Time: `8 min`
- Bar chart by duration buckets (under 5m, 5–15m, 15–30m, 30–60m, 1h+)
- Best performing bucket highlighted

**Section: R-Multiple Deep Dive**
- Table of all R values with trade link
- Avg R: `0.6`
- Best R: `+4.2` (RELIANCE 30 May)
- Worst R: `−1.8` (NIFTY 28 May)
- What % of trades hit >1R, >2R, >3R

**Section: Charges Breakdown (Indian)**
- Estimated brokerage: `₹1,620`
- STT estimate: `₹...`
- Exchange charges: `₹...`
- SEBI + Stamp: `₹...`
- Net after all charges: `₹22,880`
- Note: "These are estimates based on Zerodha-style flat pricing. Link your broker for exact charges."

### 5.5 Tab 3: Behavior (Journal + Psychology)

**Section: Emotion Performance**
- Grid: Emotion | Trades | Win Rate | Avg P&L | Total P&L
- Sorted by Total P&L desc
- Example: "Confident — 24 trades, 58% WR, +₹18,200" vs "Revenge Trading — 6 trades, 17% WR, −₹9,400"

**Section: Playbook Performance**
- Existing playbook stats but richer:
  - Playbook | Trades | Win Rate | Avg R | Total P&L | Max Consec Losses
  - Click to drill into trades for that playbook

**Section: Pre-Market Bias vs Reality**
- Did your daily bias match outcome?
- Table: Date | Bias (Bullish/Bearish) | Actual Day P&L | Bias Accuracy

**Section: What Worked / What Didn't (Aggregated)**
- Word cloud or frequency list from journal text
- Top lessons learned (manual review list)

### 5.6 Tab 4: Breakdowns (Segment, Symbol, Session, Time)

**Segment Breakdown (Critical for Indian Traders)**
- Cash (EQ) vs F&O (FO) vs Currency (CDS)
- For each: trades, win rate, total P&L, charges, net P&L
- Helps trader see if they bleed in options but make in cash

**Symbol Breakdown**
- Top 15 symbols by trade count
- Columns: Symbol | Trades | WR | Avg P&L | Total P&L | Best Day | Worst Day
- Click symbol → filtered trade log

**Session Breakdown (Indian Timings)**
- Opening (9:15–10:00) — often highest volatility
- Morning (10:00–12:00)
- Afternoon (12:00–14:00)
- Closing (14:00–15:30)
- For each: trades, WR, avg P&L, total P&L

**Day-of-Week Breakdown**
- Mon | Tue | Wed | Thu | Fri
- For each: trades, WR, avg P&L, total P&L
- Helps identify "Monday effect" or expiry-day (Thu) bias

**Monthly Trend**
- Mini bar chart: Month → Net P&L
- Green/red bars, with month label

---

## 6. Component Architecture

### 6.1 New Files to Create

```
src/app/reports/page.tsx              # Main reports page with sub-tabs
src/app/components/reports/
  OverviewTab.tsx                     # KPI pills + top charts
  PerformanceTab.tsx                  # Drawdowns, duration, R-analysis
  BehaviorTab.tsx                     # Emotions, playbooks, bias
  BreakdownsTab.tsx                   # Segment, symbol, session, DOW
  StatPill.tsx                        # Reusable KPI pill
  MiniChart.tsx                       # Wrapper for lightweight-charts
  ReportsDateRange.tsx                # Date picker specific to reports
  EmotionGrid.tsx                     # Emotion performance table
  PlaybookReportTable.tsx             # Extended playbook stats
  ChargesEstimator.tsx                # Indian charges breakdown
src/lib/compute/analytics.ts          # ALL backend formulas
src/app/api/reports/route.ts          # Aggregated analytics API
src/app/api/reports/breakdown/route.ts # Breakdown-specific API
```

### 6.2 API Design

```typescript
// GET /api/reports?range=30d | 90d | 6m | 1y | all
// Response:
{
  "range": { "start": "2025-04-01", "end": "2025-05-30" },
  "summary": {
    "netPnl": 24500,
    "grossPnl": 26120,
    "estimatedCharges": 1620,
    "totalTrades": 81,
    "winRate": 51.9,
    "profitFactor": 1.42,
    "avgWin": 1240,
    "avgLoss": 892,
    "avgWinLossRatio": 1.39,
    "expectancy": 312,
    "expectancyPct": 6.2,
    "greenDays": 18,
    "redDays": 12,
    "dayWinRate": 60.0,
    "maxDrawdown": 8200,
    "maxDrawdownPct": 8.2,
    "avgDailyReturn": 490,
    "sharpeLike": 1.8,
  },
  "equityCurve": [{ "date": "...", "equity": 100000, "drawdown": 0, "drawdownPct": 0 }],
  "dailyPnl": [{ "date": "...", "pnl": 1200 }],
  "rDistribution": { "less_than_minus1": 2, "minus1_to_0": 15, ... },
  "durationBuckets": { "under_5min": 12, "5_to_15min": 34, ... },
  "streaks": { "maxWinStreak": 5, "maxLossStreak": 4, "currentStreakType": "win", "currentStreakCount": 2 },
  "sessionBreakdown": { "Opening": { trades: 32, winRate: 48, totalPnl: 8200 }, ... },
  "dayOfWeek": { "Mon": { trades: 14, winRate: 43, totalPnl: -1200 }, ... },
  "segmentBreakdown": { "EQ": { trades: 20, ... }, "FO": { trades: 61, ... } },
  "symbolBreakdown": [ { symbol: "RELIANCE", trades: 8, winRate: 62, totalPnl: 6200 }, ... ],
  "emotionPerformance": { "Confident": { trades: 24, winRate: 58, avgPnl: 758 }, ... },
  "playbookPerformance": { /* keyed by playbook_id */ },
}
```

---

## 7. Indian Market Specifics

### 7.1 Charges Model (Zerodha-style default)
| Charge | Equity Delivery | Equity Intraday | F&O |
|--------|----------------|-----------------|-----|
| Brokerage | ₹0 | ₹20 per order | ₹20 per order |
| STT | 0.1% on sell | 0.025% on sell | 0.0125% on sell (opt) / 0.01% (fut) |
| Exchange | 0.00325% | 0.00325% | 0.0019% (NSE futures), 0.05% (options premium) |
| SEBI | ₹10/crore | ₹10/crore | ₹10/crore |
| Stamp Duty | 0.015% (buy) | 0.003% (buy) | 0.002% (fut buy), 0.003% (opt buy) |
| GST | 18% on (brokerage + exchange + SEBI) | same | same |

For MVP: use flat ₹20/order + 0.05% turnover estimate. Add exact charge breakdown later.

### 7.2 Session Labels
- 09:15–10:00: "Opening Range" (most volatile)
- 10:00–12:00: "Morning Session"
- 12:00–14:00: "Afternoon Session"
- 14:00–15:30: "Closing Session"
- Thursday expiry awareness (Nifty/BankNifty weekly)

### 7.3 Segment Awareness
- **EQ**: Cash market, CNC for delivery, MIS for intraday
- **FO**: Futures & Options, MIS/NRML
- Show margin used estimates for F&O trades (if we know lot size — can fetch from NSE or hardcode top 50)

### 7.4 NSE Holiday Handling
- Exclude non-trading days from day win % calculations
- Show "trading days" count separately from calendar days

---

## 8. Data Flow

```
User opens Reports tab
    ↓
Reports page mounts → fetch /api/reports?range=30d
    ↓
Backend: fetchAllTrades() + fetchAllTradeJournals() + fetchPlaybooks() + fetchCapitalSnapshots()
    ↓
Run computeAnalytics(trades, journals, playbooks, capital)  [lib/compute/analytics.ts]
    ↓
Return single JSON blob to frontend
    ↓
Frontend renders tabs, each tab reads from the same JSON (no extra fetches)
    ↓
User switches sub-tab → instant, already loaded
    ↓
User changes date range → new API call, recompute
```

---

## 9. Implementation Order (Phased)

### Phase 1: Foundation (Week 1)
1. Create `lib/compute/analytics.ts` with all formulas
2. Create `src/app/api/reports/route.ts` returning the big JSON
3. Create `src/app/reports/page.tsx` with sub-tab navigation
4. Build `OverviewTab` with KPI pills + cumulative P&L chart + daily bars

### Phase 2: Deep Dives (Week 2)
5. Build `PerformanceTab` with drawdowns, duration, R-multiple
6. Build `BreakdownsTab` with session, DOW, symbol, segment
7. Add `ChargesEstimator` component (Indian-specific)

### Phase 3: Behavior & Polish (Week 3)
8. Build `BehaviorTab` with emotion grid, playbook deep-dive
9. Add `capital_snapshots` table + input UI
10. Add `trade_tags` table + tagging UI in trade detail
11. Pre-market bias vs outcome analysis

### Phase 4: Export & Share (Week 4)
12. PDF/PNG export of report cards
13. Shareable report link (read-only view)
14. Weekly email report (optional)

---

## 10. Success Metrics for This Feature

- A trader can answer: "Am I profitable after charges?" in 3 seconds.
- A trader can see: "I lose money between 12–2 PM" and act on it.
- A trader can see: "My 'Breakout' playbook has 1.8R avg but I only trade it 10% of the time" → scale it.
- A trader can see: "When I journal 'Revenge Trading', my win rate is 12%" → behavioral trigger.

---

## 11. Open Questions

1. Do you want exact charge calculation (STT/SEBI/Exchange/GST per trade) or flat estimate for MVP?
2. Do you want to store capital snapshots manually, or auto-calculate from P&L + seed capital?
3. Should we add a "tagging" UI in the trade detail page for custom labels?
4. Should the Reports tab replace the current Dashboard, or be a new 5th tab?
5. Do you want the ability to compare two date ranges (e.g., this month vs last month)?
