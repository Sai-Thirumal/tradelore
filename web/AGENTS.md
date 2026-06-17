<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TradeLore Agent Instructions

Before any code change, read **[agents/main.md](./agents/main.md)** — it enforces coding standards, routes to the API/UI/DB docs, and requires doc updates on every change.

Quick links:
- [API reference](./agents/api.md) — all routes, request/response shapes, data flow, reports endpoints
- [UI reference](./agents/ui.md) — component tree, state patterns, reports, CSS architecture
- [DB reference](./agents/db.md) — schema, tables, indexes, foreign keys

Current surface area:
- Main tabs: Dashboard, Journal, Trade Log, Playbooks, Reports
- Auth: `/login`, `/auth/callback`, `src/proxy.ts`, and `/api/auth/*`
- Supabase setup: production Site URL is `https://web-phi-one-12.vercel.app`; redirect URL is `/auth/callback`; run `sql/multi-user-auth.sql` as-is when old data is not needed
- Trade detail: `/trade?idx=N`, chart + pre-market + post-market tabs
- Analytics: dashboard stats in `lib/compute/stats.ts`, reports in `/api/reports/*`
- Costs: commission calculation in `lib/engine/commission.ts`; legacy trades are enriched on read
- Multi-user rule: every DB/API operation must be scoped by authenticated `user.id`
- Deployment rule: deploy local changes directly to Vercel production only; do not push GitHub unless asked
