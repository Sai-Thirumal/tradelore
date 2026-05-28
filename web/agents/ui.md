# TradeLore — UI Reference

## Page Tree

```
/                           Main dashboard (page.tsx)
├── Dashboard tab            Stat pills, P&L charts, calendar, weekday bars
├── Journal tab              PreMarket plan + PostTrade analysis
│   ├── JournalPreMarket     Date header, market outlook, bias, capital, key levels, news
│   └── JournalPostTrade     Expandable per-trade journal forms
├── Trade Log tab            Month → Day → Trade hierarchy
├── Playbooks tab            Card grid of trading setups, tabbed create/edit form (max 8)
└── Modal                    Trade detail popup (legacy, being phased out)

/trade?idx=N                Trade detail page (trade/page.tsx)
├── Header                   Symbol, date, result badge, P&L card
├── Left panel               Quick stats (direction/qty/entry/exit) + Details + Order legs
├── Right panel              TradingView lightweight-charts (sticky) + entry/exit markers
└── Journal form             Same fields as PostTrade, synced via localStorage + API
```

---

## Component Index

### `components/Playbooks.tsx`
`src/app/components/Playbooks.tsx`

- **Props:** None (self-contained, fetches own data)
- **State:** playbooks list, formOpen, editingId, activeTab, formData, deleteTarget
- **Data flow:** GET `/api/playbooks` → mount; POST/PUT/DELETE for CRUD
- **Features:** Card grid (2-col responsive), tabbed create/edit form (9 tabs), max 8 limit, delete confirmation dialog, toast notifications
- **Tabs:** Identity → Market Conditions → Entry Rules → Stop Loss → Targets & Exit → Position Sizing → Grading → Stats & Review → Notes
- **Styles:** All scoped to `pb-` prefix in a `<style>` tag inside the component

### `components/journal/PreMarket.tsx`
`src/app/components/JournalPreMarket.tsx`

- **Props:** `{ latestTradeDate: string }`
- **State:** marketOutlook, outlookBias, capitalToDeploy, keyLevels, newsEvents
- **Data flow:** localStorage (`pre_market_plan_{date}`) → mount; API (`/api/daily-journal`) → overwrite if newer
- **Save:** POST `/api/daily-journal` on button click
- **Auto-save:** localStorage on every keystroke via `useCallback` + `useEffect`

### `components/journal/PostTrade.tsx`
`src/app/components/JournalPostTrade.tsx`

- **Props:** `{ trades: Trade[] }`
- **State:** Per-trade keyed maps (`riskAmounts[tid]`, `whatWorked[tid]`, ...)
- **Data flow:** localStorage (`trade_journal_{tradeId}`) → mount; API (`/api/trade-journal?trade_id=`) → overwrite
- **One panel open at a time:** `expandedIdx` state
- **Emotions:** Multi-select chip buttons
- **Playbooks:** Fetched from `/api/playbooks`, shown as dropdown

### `components/chart/TradeChart.tsx`
`src/app/components/TradeChart.tsx`

- **Props:** `{ symbol, direction, avgEntry, avgExit, entryTime, exitTime }`
- **Library:** `lightweight-charts` v5 (TradingView) — loaded via `next/dynamic({ ssr: false })`
- **Data source:** `/api/chart` → Yahoo Finance proxy
- **Features:** CandlestickSeries, `createSeriesMarkers()` for entry/exit arrows, `createPriceLine()` for dashed lines
- **States:** loading → error → ok (all rendered in single return, ref div always mounted)
- **Smart interval:** 5-min for intraday, daily for multi-day trades

### Page Files

| File | Type | Notes |
|------|------|-------|
| `app/page.tsx` | Client | Main dashboard, 3 tabs, ~470 lines |
| `app/layout.tsx` | Server | Root layout |
| `app/trade/page.tsx` | Client | Trade detail, `useSearchParams`, journal form |
| `app/trade/layout.tsx` | Server | `force-dynamic` for `useSearchParams` |
| `app/globals.css` | Global | All styles, ~900 lines, CSS custom properties |

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
Broker CSV rows → csv-parser.ts (parse)
  → storeOrders() (Supabase insert)
  → fetchAllOrders() (Supabase select, paginated)
  → collapseFills() (merge by order_id, weighted avg price)
  → matchTrades() (position tracker by symbol+date)
  → replaceTrades() (Supabase delete+insert)
  → fetchAllTrades() (Supabase select, paginated)
  → Frontend renders
```

### Trade ID generation
```ts
function getTradeId(t: Trade): string {
  return t.id || `${t.symbol}_${t.entry_time || t.entryTime}`;
}
```
Used consistently across JournalPostTrade, trade detail page, localStorage keys, and API calls.

---

## CSS Architecture

Single `globals.css` file, organized by section with comment headers:
- `── Header ──`, `── Nav ──`, `── Main ──`
- `── Stat Pills ──`, `── Charts ──`, `── Calendar ──`
- `── JOURNAL — Pre-Market Plan ──`, `── JOURNAL — Post-Trade Analysis ──`
- `── TRADE LOG — Month Sections ──`, `── Day groups ──`
- `── TRADE DETAIL PAGE ──`

All colors via CSS custom properties. Reuse existing classes before adding new ones.
