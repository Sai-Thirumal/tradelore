# TradeLore

A trading journal and analytics dashboard for Indian markets. Import broker CSV files, track P&L, journal every trade, build repeatable playbooks, and visualise performance — all in one place.

**Live:** [web-phi-one-12.vercel.app](https://web-phi-one-12.vercel.app)

---

## Features

| Section | What it does |
|---|---|
| **Dashboard** | Net P&L, win rate, profit factor, day win %. Cumulative P&L curve, daily P&L bars, monthly calendar with weekly totals |
| **Journal** | Pre-market plan (outlook, bias, levels, news) + per-trade post-market analysis with emotion tagging and playbook linking |
| **Trade Log** | Every trade grouped by month → day → trade. Expand orders to see every fill. Click any trade for full detail |
| **Trade Detail** | Dedicated page with stats, TradingView chart with entry/exit markers, synced journal form |
| **Playbooks** | Create up to 8 trading setups with full detail across 9 categories. Win rate and avg R:R computed automatically from tagged trades |
| **Date Filter** | Dual-calendar date range picker — filter the entire dashboard by any date range |
| **Charts** | TradingView `lightweight-charts` with entry/exit markers, auto-detects intraday vs daily candles |

---

## How it works

### 1. Import your broker CSV
Upload a CSV from your broker (Zerodha, Upstox, etc.). TradeLore parses every row, collapses partial exchange fills by order ID, runs a position tracker, and builds completed trades.

```
Broker CSV → Parse rows → Collapse fills → Position tracker → Completed trades
```

### 2. Dashboard
Real-time stats and charts that update when you filter by date range. Cumulative P&L curve, daily bar chart, monthly calendar heatmap with weekly P&L totals.

### 3. Journal
Synced via localStorage + Supabase:

- **Pre-Market Plan** — Market outlook, bias, capital to deploy, key levels, news to watch. Saved per date.
- **Post-Market Analysis** — For every trade: risk taken, profit targets, position sizing, playbook used, what worked/didn't, lessons learned, emotion tags.

### 4. Trade Log
All trades grouped by month → day. Each month shows trade count, W/L ratio, win rate, and total P&L. Expand a month to see daily breakdowns. Expand "Orders" on any trade to see every exchange fill.

### 5. Trade Detail
Click any trade row to open a dedicated page with:
- Full trade stats, order legs
- TradingView chart of the underlying asset with entry/exit markers and price lines
- Journal form synced with the Journal tab

### 6. Playbooks
Build your trading setup library. Each playbook covers 9 categories:

Identity → Market Conditions → Entry Rules → Stop Loss → Targets & Exit → Position Sizing → Grading → Notes

Win rate and average R:R are **computed automatically** from trades you tag with each playbook — no manual data entry. Max 8 setups enforced. Ships with 3 example playbooks (Opening Range Breakout, VWAP Mean Reversion, Trend Continuation Pullback) that you can edit or remove.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS custom properties |
| Charts | Chart.js (dashboard) + lightweight-charts v5 (trade detail) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| Price data | Yahoo Finance (server-side proxy, IST timezone-aware) |
| CSV parsing | PapaParse |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard + Journal + Trade Log + Playbooks
│   ├── globals.css               # All styles (~950 lines, CSS custom properties)
│   ├── trade/
│   │   ├── layout.tsx            # force-dynamic for useSearchParams
│   │   └── page.tsx              # Trade detail page (/trade?idx=N)
│   ├── api/
│   │   ├── chart/                # Yahoo Finance proxy (period1/period2, IST-aware)
│   │   ├── import/               # CSV upload → parse → match → store
│   │   ├── trades/               # All completed trades (paginated)
│   │   ├── daily-journal/        # Pre-market plan CRUD
│   │   ├── trade-journal/        # Per-trade journal CRUD
│   │   ├── playbooks/            # Playbook CRUD (GET/POST/PUT/DELETE)
│   │   │   └── stats/            # Computed playbook stats from tagged trades
│   │   └── clear/                # Wipe all data
│   └── components/
│       ├── journal/              # PreMarket, PostTrade
│       ├── chart/                # TradeChart (lightweight-charts v5)
│       ├── Playbooks.tsx         # Card grid + 9-tab create/edit form
│       └── DateRangePicker.tsx   # Dual-month calendar date range filter
├── lib/
│   ├── db/supabase.ts            # Supabase client (lazy-loaded) + all data access
│   ├── engine/                   # CSV parser, trade matcher (collapse + position tracker)
│   ├── compute/stats.ts          # P&L stats, date range filtering
│   └── ui/format.ts              # INR, price, date formatters
├── sql/
│   ├── setup-journal.sql         # Base Supabase table migrations
│   └── playbooks-migration.sql   # Playbooks expanded schema + seed data
└── agents/                       # AI navigation docs
    ├── main.md                   # Coding standards, design tokens, deploy
    ├── api.md                    # Full API reference (8 routes)
    ├── ui.md                     # Component tree + state patterns
    └── db.md                     # Database schema (5 tables)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project

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

### Database
Run these SQL files in your Supabase SQL Editor (in order):
1. `sql/setup-journal.sql` — creates all tables
2. `sql/playbooks-migration.sql` — expands playbooks schema + seeds 3 examples

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
|---|---|
| `trade_orders` | Raw broker fills (one per exchange execution) |
| `trades` | Completed trades (built by position tracker) |
| `playbooks` | Trading setups — name + structured data (JSONB), 3 examples seeded |
| `trade_journal` | Per-trade post-market analysis, linked to playbooks |
| `daily_journal` | Pre-market plans by date |

Full schema: [`agents/db.md`](agents/db.md)

---

## Design

TradeLore follows a light-theme aesthetic with a clean, data-dense layout. All colors use CSS custom properties:

```
--brand: #f97316    --green: #16a34a    --red: #dc2626
--text: #1a1a1a     --text-secondary: #737373
--bg: #ffffff       --surface: #fafafa   --border: #e5e5e5
```

Components reuse shared CSS classes (`.section`, `.stat-pill`, `.badge`, `.nav-tab`, `.import-btn`) for visual consistency across all tabs.

---
