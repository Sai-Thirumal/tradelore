# TradeLore — Agent Reference

> **Load this before any code change.** Route all decisions through these docs.
> If you change code, update the relevant agent doc in the same commit.

## Index

| Doc | Purpose |
|-----|---------|
| [api.md](./api.md) | API routes, request/response shapes, reports, data flow |
| [ui.md](./ui.md) | Component tree, page structure, reports, state management |
| [db.md](./db.md) | Database schema, tables, foreign keys, indexes |

---

## Coding Practices

### SOLID Principles

- **S**ingle Responsibility — one file = one job. `trade-matcher.ts` matches trades. It does not parse CSVs. It does not talk to Supabase.
- **O**pen/Closed — extend with new files, not patches on existing ones. A new report type goes in its own component, not an if-else chain.
- **L**iskov — components receiving `trades: Trade[]` must work with any array that satisfies the interface, filtered or unfiltered.
- **I**nterface Segregation — API responses return only what the client needs. No raw database rows leaking Supabase internals to the frontend.
- **D**ependency Inversion — `page.tsx` depends on component interfaces, not component internals. Components depend on `lib/` utilities, not on page state.

### File Organization

```
src/
├── lib/
│   ├── db/           — Supabase client + data access functions
│   ├── auth/         — Route-handler auth/session helpers
│   ├── supabase/     — Browser, server, and proxy Supabase SSR clients
│   ├── engine/       — CSV parsing, trade matching, symbol helpers, commission
│   ├── compute/      — Stats, filtering, aggregation (PURE — no DB, no DOM)
│   └── ui/           — Formatting (fmtINR, fmtPrice, fmtDateLabel)
├── app/
│   ├── components/
│   │   ├── journal/  — PreMarket, PostTrade
│   │   ├── chart/    — TradeChart
│   │   ├── reports/  — ReportsOverview, ReportsList, DayTimeReport
│   │   ├── Playbooks.tsx  — Trading setup playbooks (card grid + tabbed form)
│   │   ├── DateRangePicker.tsx — Dual-calendar date range filter
│   │   └── shared/   — Reusable (buttons, inputs, modals)
│   ├── api/          — Next.js API routes (file = route)
│   ├── login/        — Supabase Auth sign-up/login landing page
│   ├── auth/         — Supabase callback routes
│   └── trade/        — Trade detail page
```

### Rules

1. **No code without spec.** If the user hasn't given a complete feature spec, ask clarifying questions. DO NOT write implementation code.
2. **Update agent docs on every change.** New API route → update `api.md`. New component → update `ui.md`. Schema change → update `db.md`.
3. **Deploy after each logical chunk.** Backend change → deploy. Frontend change → deploy. Integration → deploy. Catch failures early.
4. **Deploy only to Vercel unless asked otherwise.** Push to GitHub only when the user explicitly requests it.
5. **Supabase pagination.** Every `.select('*')` without `.limit()` or `.single()` caps at 1,000 rows. Always paginate with `.range(from, to)` for functions that can exceed this.
6. **TypeScript strict.** No `any` in lib functions. Use `any` sparingly in components for Supabase row types.
7. **Client components need `'use client'`.** Server components are the default. `useSearchParams` requires `force-dynamic` in a server-component layout.
8. **CSS tokens only.** Use `var(--brand)`, `var(--text)`, etc. Never hardcode colors. Reuse existing classes (`.section`, `.stat-pill`, `.badge`) before writing new ones.

### Current Product Surface

- Main tabs: Dashboard, Journal, Trade Log, Playbooks, Reports.
- Authentication is Supabase Auth via `@supabase/ssr`; `proxy.ts` refreshes sessions and redirects logged-out page requests to `/login`.
- API route handlers must call `requireAuthUser()` and pass `user.id` into `lib/db/supabase.ts` functions. Data access uses the signed-in user's request-scoped Supabase session so RLS remains active; do not use service-role credentials for normal app reads/writes.
- Supabase production Auth config should use Site URL `https://web-phi-one-12.vercel.app` and Redirect URL `https://web-phi-one-12.vercel.app/auth/callback`.
- If old data is not needed, run `sql/multi-user-auth.sql` as-is; its commented backfill section is optional.
- Dashboard stats are computed in `lib/compute/stats.ts` and should be commission-aware when displaying net values.
- Reports live in `app/components/reports/` and `/api/reports/*`; add new report categories as separate components/routes instead of extending one giant conditional.
- Public visitors see the marketing landing page at `/`; signed-in product work lives at `/dashboard`.
- Trade detail lives at `/trade?idx=N` and has View Trade, Pre Market, and Post Market tabs.
- Commission logic lives in `lib/engine/commission.ts`; `trades` rows may contain stored commission fields, and API reads backfill legacy rows that do not.
- DB rows are multi-tenant: `trade_orders`, `trades`, `playbooks`, `trade_journal`, and `daily_journal` all require `user_id`.

### Design Tokens

```css
--brand: #f97316    --green: #16a34a    --red: #dc2626
--text: #1a1a1a     --text-secondary: #737373
--bg: #ffffff       --surface: #fafafa   --border: #e5e5e5
--radius: 10px      --radius-sm: 6px
--font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif
```

### Deploy

```bash
cd /Users/saithirumalreddy/tradelore/web
npx vercel deploy --prod --yes --token $VERCEL_TOKEN
```

Production URL: `https://web-phi-one-12.vercel.app`

### Reverting

```bash
cd /Users/saithirumalreddy/tradelore/web
git restore .          # Revert all local changes
git restore <file>     # Revert specific file
```
