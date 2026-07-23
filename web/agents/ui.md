# TradeLore — UI Reference

## Page Tree

```
/                           Public marketing landing page (page.tsx)
├── LandingNav               Tradezella-style nav: Products/Solutions/Resources dropdowns,
│                            Supported Brokers, Pricing, Log in, Get Started + mobile hamburger
│                            (components/landing/LandingNav.tsx, client)
├── Hero                     Horizontal title + dashboard screenshot nudged right
├── Brokers strip            "Auto-syncs with" Zerodha + Delta Exchange (replaces old 6 cards)
├── Four products. One hub.  Eyebrow + gradient heading + product chips
├── Workflow showcase        4 numbered scroll-reveal product blocks (broker sync, journaling,
│                            trade replay, analytics); WorkflowShowcase.tsx uses Reveal.tsx
│                            (IntersectionObserver fade+slide). Trade replay is block #3.
├── Pricing                  Narrow one-card Pro plan: launch offer until August 31, one-month free
│                            demo, ₹199/month price comparison, product feature checklist, and CTA.
├── Final CTA                #get-started
└── LandingFooter            Dark footer: link columns + risk disclaimer + X/Instagram
                             Company includes About Us → `/about`
                             (components/landing/LandingFooter.tsx; update social handles)

/about                      Public SEO page with TradeLore origin story, founder section,
                             mission/vision, and founder portrait (`founder-thirumal.jpeg`).

Landing motion: `components/landing/Reveal.tsx` is a client wrapper that adds
`is-visible` when an element scrolls into view (honors prefers-reduced-motion).
All `.landing-*` / `.workflow-*` / `.reveal` styles live in globals.css under the
"LANDING REDESIGN" block. The whole page uses one subtle fixed orange gradient
(`.landing-page` background).

/dashboard                   Main authenticated dashboard (dashboard/page.tsx)
├── Dashboard tab            Stat pills, P&L charts, monthly calendar
│   └── Header broker sync   Broker status chip + connect/sync/settings actions
├── Journal tab              PreMarket plan + PostTrade analysis
│   ├── PreMarket            Date header, market outlook, bias, capital, key levels, news
│   └── PostTrade            Expandable per-trade journal forms
├── Trade Log tab            Month → Day → Trade hierarchy
├── Playbooks tab            Card grid of trading setups, tabbed create/edit form (max 8)
├── Reports tab              Overview metrics + grouped report tables/charts
└── Modal                    Trade detail popup (legacy, being phased out)

/login                      Focused Supabase auth page
└── Auth panel               Sign up / Log in form, redirects to `/dashboard` by default

/settings/broker            Broker picker, backed by `BROKER_CATALOG`
├── Zerodha Settings         Personal API key/secret + Kite connect/sync + Help
├── Dhan Settings            Client ID + access token sync + Help
├── Upstox Settings          API key/secret + OAuth connect/sync + Help
├── Angel One Settings       SmartAPI key + JWT token sync + Help
└── Delta Settings           API key/secret sync + Help

/trade?idx=N                Trade detail page (trade/page.tsx)
├── Header                   Back link, same-day trade switcher, result badge, P&L
├── View Trade tab           Quick stats, gross/net P&L, order legs, chart
├── Pre Market tab           Read-only daily pre-market plan
└── Post Market tab          Journal form synced via localStorage + API
```

Mobile note: trade detail constrains the top header to the viewport, truncating long option symbols and shrinking P&L/result labels so the tab card below does not make the page move horizontally. Shared journal subtab rows scroll horizontally inside their own strip; the trade detail `View Trade / Pre Market / Post Market` row uses three equal-width tabs on mobile.

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
- **Features:** Sign up / Log in segmented control, email/password form, email confirmation message, redirect to sanitized internal `next` path
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
- **Implemented:** Day & Time, Instruments, Risk, Playbooks, and Options
- **Placeholders:** None

### `components/reports/DayTimeReport.tsx`
`src/app/components/reports/DayTimeReport.tsx`

- **Props:** `{ group: 'days' | 'months' | 'trade-time' | 'trade-duration' | 'instruments' | 'deployed-capital' | 'playbooks' | 'options-expiry' }`
- **Data source:** GET `/api/reports/day-time?group=...`
- **Features:** stat cards, Chart.js line/bar charts, table pagination, P&L sorting, min-trades filter, W/L ratio filter
- **Chart modes:** P&L and win % for instruments; combo P&L/count/avg-win plus win % for day/time groups
- **Responsive:** Day & Time secondary tabs and report tables scroll horizontally inside their own containers on small screens so the page viewport stays fixed.

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

- **Props:** `{ symbol, exchange?, direction, avgEntry, avgExit, entryTime, exitTime, orders? }`
- **Library:** `lightweight-charts` v5 (TradingView) — loaded via `next/dynamic({ ssr: false })`
- **Data source:** `/api/chart` → Yahoo Finance proxy
- **Features:** CandlestickSeries, `createSeriesMarkers()` for entry/exit arrows, deduped order markers by candle/price/type
- **States:** loading → error → ok (all rendered in single return, ref div always mounted)
- **Smart interval:** 5-min for intraday, daily for multi-day trades
- **MCX behavior:** supported commodity families use a labelled global-futures reference chart; unsupported families show an explicit unavailable state and keep the `MCX:symbol` TradingView link

### Page Files

| File | Type | Notes |
|------|------|-------|
| `app/page.tsx` | Server | Public landing page with product screenshots and CTAs into auth |
| `app/dashboard/page.tsx` | Client | Main dashboard, 5 tabs (Dashboard, Journal, Trade Log, Playbooks, Reports) |
| `app/layout.tsx` | Server | Root layout |
| `app/login/page.tsx` | Client | Focused Supabase sign-up/login page |
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
  → NFO/BFO/MCX instrument metadata enrichment
  → storeOrders(userId) (Supabase insert with user_id)
  → fetchAllOrders(userId) (Supabase select, paginated)
  → collapseFills() (merge by order_id, weighted avg price)
  → matchTrades() (position tracker by symbol+date)
  → replaceTrades(userId) (delete+insert only that user's trades)
  → fetchAllTrades(userId) (Supabase select, paginated)
  → Frontend renders
```

Only completed positions are rendered. Unmatched/unrealized positions remain intentionally excluded pending a separate product specification.

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

### Broker sync flow
```
Dashboard mount
  → GET /api/broker/zerodha/status
  → GET /api/broker/delta/status
  → if supported broker credentials exist, sync eligible brokers once quietly
  → if configured + connected + token valid, POST /api/broker/zerodha/sync once quietly
  → for Dhan, Upstox, and Angel One, POST /api/broker/{broker}/sync once quietly when credentials/session state allows
  → sync stores broker fills as raw trade_orders and reloads /api/trades
  → if a session token expires, settings/status show the reconnect or refresh-token path for that broker
```

Header states for the active broker family:
- `{Broker} off`: server encryption/service-role env vars are missing; button disabled.
- `Setup {Broker}`: user has not saved required credentials.
- `Connect {Broker}` / refresh-token messaging: no stored token or the broker session token expired.
- `Sync {Broker}`: valid credentials/session exist but no successful sync is recorded yet.
- After a successful sync, the action button is hidden and only the green `Synced` chip remains.
- Status chip shows `Setup needed`, `Needs reconnect`, `Connected`, or `Synced` without a timestamp.
- Broker Settings lists all registered brokers from `BROKER_CATALOG`, including Zerodha, Dhan, Upstox, Angel One, and Delta.
- Billing is reachable from the dashboard overflow/profile menu and opens `/settings/billing`.
- When `/api/billing/status` returns `hasAccess: false`, Dashboard shows an expired-trial popup with a `View Launch Plan` button linking to `/settings/billing`.
- Each broker settings page exposes an expandable Help panel with setup and sync steps.

Mobile header:
- Below 768px, the header uses two rows: the TradeLore logo sits alone on the first row, and the compact Date Range, segment controls, broker status chip, and overflow `...` menu sit on the second row; below 430px, button/logo sizing tightens to avoid overlap on real phone browsers.
- Mobile-only overflow menu contains Import CSV, Clear data, billing, broker settings/connect/sync when needed, and Login/Logout. Desktop keeps the inline controls.
- The Date Range calendar popover is viewport-centered on mobile, with a lower offset on narrow two-row headers.

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
