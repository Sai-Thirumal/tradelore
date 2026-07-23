# Design QA — pricing card spacing

- Source visual truth: `/Users/saithirumalreddy/Desktop/Screenshot 2026-07-23 at 13.17.36.png`
- Source dimensions: 768 × 764 px.
- Intended implementation viewport: 768 × 764 CSS px at device scale factor 1.
- State: logged-out landing page, pricing card.

**Findings**

- [P2] Inconsistent vertical rhythm in the pricing card.
  Location: `.landing-pricing-card` in `src/app/globals.css`.
  Evidence: the prior card used independent margins of 16px, 10px, 18px, 6px, and 20px between its sequential items.
  Fix: use a 16px flex `gap` and reset the individual margins; the offer badge remains content-sized.

**Comparison History**

1. The P2 spacing issue was fixed in CSS.
2. Browser-rendered comparison is blocked: the local Next.js landing route does not return a response because the server-side authentication check waits on an unavailable Supabase request. The in-app Browser therefore has no implementation screenshot to compare to the source.

**Implementation Checklist**

- [x] Apply a consistent 16px spacing rhythm.
- [x] Keep the badge content-sized and CTA full width.
- [x] Run `npm run lint`.
- [ ] Capture and compare the rendered card when the local Supabase request is available.

**Follow-up Polish**

- None.

final result: blocked
