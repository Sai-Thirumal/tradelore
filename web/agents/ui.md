# TradeLore — UI Reference

## Page Tree

```
/                           Main dashboard (page.tsx)
├── Dashboard tab            Stat pills, P&L charts, monthly calendar
├── Journal tab              PreMarket plan + PostTrade analysis
│   ├── PreMarket            Date header, market outlook, bias, capital, key levels, news
│   └── PostTrade            Expandable per-trade journal forms
├── Trade Log tab            Month → Day → Trade hierarchy
├── Playbooks tab            Card grid of trading setups, tabbed create/edit form (max 8)
├── Reports tab              Overview metrics + grouped report tables/charts
└── Modal                    Trade detail popup (legacy, being phased out)

/login                      Sign-up/login landing page
├── Left visual panel        Brand, value copy, dashboard preview
└── Right auth panel         Sign up / Log in form

/trade?idx=N                Trade detail page (trade/page.tsx)
├── Header                   Back link, same-day trade switcher, result badge, P&L
├── View Trade tab           Quick stats, gross/net P&L, order legs, chart
├── Pre Market tab           Read-only daily pre-market plan
└── Post Market tab          Journal form synced via localStorage + API
```

---

## Component Index

### `components/Playbooks.tsx`
`src/app/components/Playbooks.tsx`

- **Props:** None (self-contained, fetches own data + computed stats)
- **State:** playbooks list, stats (per-playbook computed metrics), formOpen, editingId, activeTab, formData, deleteTarget
- **Data flow:** GET `/api/playbooks` → mount; GET `/api/playbooks/stats` → computed win rate & avg R:R; POST/PUT/DELETE for CRUD
- **Features:** Card grid (2-col responsive), tabbed create/edit form (8 tabs), max 8 limit, computed live stats, delete confirmation dialog
- **Tabs:** Identity → Market Conditions → Entry Rules → Stop Loss → Targets & Exit → Position Sizing → Grading → Notes
- **Markets:** Stocks, Indices, Options, Futures (tag chips)
- **Stats:** Win rate and avg R:R computed from actual tagged trades, not manually entered

### `app/login/page.tsx`
`src/app/login/page.tsx`

- **Type:** Client page, dynamic layout
- **Data source:** Supabase Auth via `lib/supabase/client.ts`
- **Features:** Sign up / Log in segmented control, email/password form, email confirmation message, redirect to `next` path
- **Callback:** `/auth/callback` exchanges email/OAuth codes for a server session
- **Production Auth URL:** Supabase redirect must include `https://web-phi-one-12.vercel.app/auth/callback`

### `components/reports/ReportsPage.tsx`
`src/app/components/reports/ReportsPage.tsx`

- **Props:** None
- **State:** `subTab` (`overview` or `reports`)
- **Data flow:** delegates fetching to child components
- **Features:** Overview/Reports subtab shell for the Reports main nav tab

### `components/reports/ReportsOverview.tsx`
`src/app/components/reports/ReportsOverview.tsx`

- **Props:** None
- **Data source:** GET `/api/reports/overview`
- **Features:** Two-column overview table sections for trade performance, holding/volume, trading days, daily P&L, risk/drawdown
- **Metrics:** net P&L, largest win/loss, profit factor, hold times, logged days, drawdown, R-multiples, total commissions

### `components/reports/ReportsList.tsx`
`src/app/components/reports/ReportsList.tsx`

- **Props:** None
- **State:** report category dropdown, day/time subtab, dropdown open state
- **Categories:** Day & Time, Instruments, Risk, Playbooks, Options
- **Implemented:** Day & Time and Instruments
- **Placeholders:** Risk, Playbooks, Options

### `components/reports/DayTimeReport.tsx`
`src/app/components/reports/DayTimeReport.tsx`

- **Props:** `{ group: 'days' | 'months' | 'trade-time' | 'trade-duration' | 'instruments' }`
- **Data source:** GET `/api/reports/day-time?group=...`
- **Features:** stat cards, Chart.js line/bar charts, table pagination, P&L sorting, min-trades filter, W/L ratio filter
- **Chart modes:** P&L and win % for instruments; combo P&L/count/avg-win plus win % for day/time groups

### `components/journal/PreMarket.tsx`
`src/app/components/journal/PreMarket.tsx`

- **Props:** `{ latestTradeDate: string }`
- **State:** marketOutlook, outlookBias, capitalToDeploy, keyLevels, newsEvents
- **Data flow:** localStorage (`pre_market_plan_{date}`) → mount; API (`/api/daily-journal`) → overwrite if newer
- **Save:** POST `/api/daily-journal` on button click
- **Auto-save:** localStorage on every keystroke via `useCallback` + `useEffect`

### `components/journal/PostTrade.tsx`
`src/app/components/journal/PostTrade.tsx`

- **Props:** `{ trades: Trade[]; date: string }`
- **State:** Per-trade keyed maps (`riskAmounts[tid]`, `whatWorked[tid]`, ...)
- **Data flow:** localStorage (`trade_journal_{tradeId}`) → mount; API (`/api/trade-journal?trade_id=`) → overwrite
- **One panel open at a time:** `expandedIdx` state
- **Emotions:** Multi-select chip buttons
- **Playbooks:** Fetched from `/api/playbooks`, shown as dropdown

### `components/chart/TradeChart.tsx`
`src/app/components/chart/TradeChart.tsx`

- **Props:** `{ symbol, direction, avgEntry, avgExit, entryTime, exitTime, orders? }`
- **Library:** `lightweight-charts` v5 (TradingView) — loaded via `next/dynamic({ ssr: false })`
- **Data source:** `/api/chart` → Yahoo Finance proxy
- **Features:** CandlestickSeries, `createSeriesMarkers()` for entry/exit arrows, deduped order markers by candle/price/type
- **States:** loading → error → ok (all rendered in single return, ref div always mounted)
- **Smart interval:** 5-min for intraday, daily for multi-day trades

### Page Files

| File | Type | Notes |
|------|------|-------|
| `app/page.tsx` | Client | Main dashboard, 5 tabs (Dashboard, Journal, Trade Log, Playbooks, Reports) |
| `app/layout.tsx` | Server | Root layout |
| `app/login/page.tsx` | Client | Sign-up/login landing page |
| `app/login/layout.tsx` | Server | `force-dynamic` for `useSearchParams` |
| `app/auth/callback/route.ts` | Route | Supabase callback code exchange |
| `app/trade/page.tsx` | Client | Trade detail, `useSearchParams`, same-day switcher, chart/pre-market/post-market tabs |
| `app/trade/layout.tsx` | Server | `force-dynamic` for `useSearchParams` |
| `app/globals.css` | Global | All styles, ~1500 lines, CSS custom properties |

---

## State Patterns

### localStorage + API sync (journal data)
```
1. Component mounts
2. Read localStorage → setState (instant)
3. Fetch API → if data exists and newer, overwrite state
4. Every onChange → update localStorage (auto-save)
5. Save button → POST to API
```

### Trade matching pipeline
```
Signed-in user → Broker CSV rows → csv-parser.ts (parse)
  → storeOrders(userId) (Supabase insert with user_id)
  → fetchAllOrders(userId) (Supabase select, paginated)
  → collapseFills() (merge by order_id, weighted avg price)
  → matchTrades() (position tracker by symbol+date)
  → replaceTrades(userId) (delete+insert only that user's trades)
  → fetchAllTrades(userId) (Supabase select, paginated)
  → Frontend renders
```

### Reports data flow
```
Reports tab
  → ReportsPage subtab shell
  → ReportsOverview → /api/reports/overview
  → ReportsList → DayTimeReport → /api/reports/day-time?group=...
  → Chart.js charts + paginated/filterable table
```

### Auth UI flow
```
Logged-out visitor
  → proxy.ts redirects protected pages to /login
  → sign up or log in
  → /auth/callback creates session for email/OAuth redirects
  → header shows Logout next to Import CSV
```

### Trade ID generation
```ts
function getTradeId(t: Trade): string {
  return t.id || `${t.symbol}_${t.entry_time || t.entryTime}`;
}
```
Used consistently across PostTrade, trade detail page, localStorage keys, and API calls.

---

## CSS Architecture

Single `globals.css` file, organized by section with comment headers:
- `── Header ──`, `── Nav ──`, `── Main ──`
- `── Stat Pills ──`, `── Charts ──`, `── Calendar ──`
- `── JOURNAL — Pre-Market Plan ──`, `── JOURNAL — Post-Trade Analysis ──`
- `── TRADE LOG — Month Sections ──`, `── Day groups ──`
- `── REPORTS ──`
- `── TRADE DETAIL PAGE ──`

All colors via CSS custom properties. Reuse existing classes before adding new ones.
