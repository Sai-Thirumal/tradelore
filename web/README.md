# TradeLore

A trading journal and analytics dashboard for Indian markets. Import broker CSV files, track P&L, journal your trades, and visualise performance — all in one place.

**Live:** [web-phi-one-12.vercel.app](https://web-phi-one-12.vercel.app)

---

## Overview

TradeLore takes raw broker trade data (CSV) and turns it into actionable insights:

| Feature | What it does |
|---------|-------------|
| **Dashboard** | P&L charts, calendar heatmap, weekday performance, win rate, profit factor |
| **Journal** | Pre-market plan + per-trade post-market analysis with emotion tagging |
| **Trade Log** | Every trade grouped by month → day → trade, with order legs |
| **Trade Detail** | Click any trade → dedicated page with stats, TradingView chart, journal |
| **Charts** | TradingView `lightweight-charts` with entry/exit markers, auto-detects intraday vs daily |

---

## How it works

### 1. Import your broker CSV
Upload a CSV file from your broker (Zerodha, Upstox, etc.). TradeLore parses every row, collapses partial exchange fills, runs a position tracker, and builds completed trades.

```
Broker CSV → Parse rows → Collapse fills by order_id → Position tracker → Completed trades
```

### 2. Dashboard
Real-time stats: Net P&L, win rate, profit factor, day win %, average win/loss. Cumulative P&L curve, daily bar chart, monthly calendar with weekly P&L totals, and weekday performance bars.

### 3. Journal
Two parts, synced via localStorage + Supabase:

- **Pre-Market Plan** — Market outlook, bias, capital to deploy, key levels, news to watch. Saved per date.
- **Post-Market Analysis** — For every trade on your latest trading day: risk taken, profit targets, position sizing, playbook used, what worked/didn't, lessons learned, emotion tags.

### 4. Trade Log
All trades grouped by month → day → trade. Each month shows trade count, W/L ratio, win rate, and total P&L. Expand a month to see daily breakdowns. Expand "Orders" on any trade to see every fill.

### 5. Trade Detail (click any trade)
Opens in a new tab with:
- Full trade stats, order legs
- TradingView chart of the **underlying asset** with entry/exit markers and price lines
- Full journal form synced with the Journal tab

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom properties |
| Charts | Chart.js (dashboard) + lightweight-charts (trade detail) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| Price data | Yahoo Finance (server-side proxy) |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard + Journal + Trade Log
│   ├── globals.css            # All styles
│   ├── trade/page.tsx         # Trade detail page (/trade?idx=N)
│   ├── api/                   # REST API routes
│   │   ├── chart/             # Yahoo Finance proxy for TradingView
│   │   ├── import/            # CSV upload pipeline
│   │   ├── trades/            # All completed trades
│   │   ├── daily-journal/     # Pre-market plan CRUD
│   │   ├── trade-journal/     # Per-trade journal CRUD
│   │   ├── playbooks/         # Trading strategies CRUD
│   │   └── clear/             # Wipe all data
│   └── components/
│       ├── journal/           # PreMarket, PostTrade
│       └── chart/             # TradeChart (lightweight-charts)
├── lib/
│   ├── db/supabase.ts         # Supabase client + data access
│   ├── engine/                # CSV parser, trade matcher, symbol helpers
│   ├── compute/stats.ts       # P&L stats, time filtering
│   └── ui/format.ts           # Currency, price, date formatters
├── agents/                    # AI navigation docs
│   ├── main.md                # Coding standards + doc routing
│   ├── api.md                 # API reference
│   ├── ui.md                  # Component tree + state patterns
│   └── db.md                  # Database schema
└── sql/setup-journal.sql      # Supabase table migration
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project (tables created via `sql/setup-journal.sql`)

### Setup
```bash
git clone https://github.com/Sai-Thirumal/tradelore.git
cd tradelore/web
npm install
```

### Environment
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Run
```bash
npm run dev      # http://localhost:3000
```

### Deploy
```bash
npx vercel --prod
```

---

## Database

5 tables in Supabase (PostgreSQL):

| Table | Purpose |
|-------|---------|
| `trade_orders` | Raw broker fills (one per exchange execution) |
| `trades` | Completed trades (built by position tracker) |
| `playbooks` | Trading strategies (5 seeded by default) |
| `trade_journal` | Per-trade post-market analysis |
| `daily_journal` | Pre-market plans by date |

Full schema: [`agents/db.md`](agents/db.md)

---

## License

MIT
