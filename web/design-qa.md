# Design QA - pricing card structure

- Source visual truth: `/Users/saithirumalreddy/Desktop/Screenshot 2026-07-23 at 14.54.35.png`
- Source dimensions: 1572 x 1234 px.
- Implementation screenshot: `/Users/saithirumalreddy/tradelore/web/pricing-viewport.jpg`
- Implementation screenshot dimensions: 579 x 772 px.
- Viewport/state: logged-out landing page at `http://localhost:3000/#pricing`, in-app browser viewport.
- Density normalization: none; source used for structure only because the user explicitly excluded the color palette and clarified this should not become two cards.
- Focused region comparison: pricing section/card only.

**Findings**

- No P0/P1/P2 issues remain for the requested structure.

**Required Fidelity Surfaces**

- Fonts and typography: existing landing typography is preserved; card hierarchy now follows the reference structure with plan title, support line, large price, feature list, and CTA.
- Spacing and layout rhythm: the card uses a taller structured layout with generous padding, clear price/list separation, and CTA anchored after the content.
- Browser annotation pass: pricing card width was reduced to 430 px in the rendered viewport.
- Colors and visual tokens: existing TradeLore palette is preserved as requested.
- Image quality and asset fidelity: no raster assets are part of this pricing card; checklist uses the existing `lucide-react` icon library.
- Copy and content: offer text says `Launch offer until August 31`; the checklist now uses current TradeLore product features instead of generic plan benefits.

**Comparison History**

1. Earlier spacing-only QA was blocked by a stale local dev server.
2. The stale Next server was killed, the app was restarted on port 3000, and the rendered pricing section was captured.
3. The implementation was compared against the provided reference structure after the user clarified this should remain one card.
4. Browser comments requested a narrower card, real product features, and existing font weight; the rendered card now measures 430 px with 14 px feature text and the original 42 px price treatment.

**Implementation Checklist**

- [x] Keep a single pricing card.
- [x] Add the reference-style internal structure: offer label, plan name, support line, price block, feature checklist, bottom CTA.
- [x] Reduce the card width.
- [x] Use actual TradeLore feature copy.
- [x] Keep the existing TradeLore font scale and weight.
- [x] Preserve the current TradeLore palette.
- [x] Verify with `npm run lint`.
- [x] Capture browser-rendered pricing evidence.

**Follow-up Polish**

- None.

final result: passed
