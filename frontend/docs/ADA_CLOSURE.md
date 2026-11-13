# ADA Pre-Merge Closure Sign-Off

Closure pass for remaining WCAG gaps flagged after the tiered ADA work (`d5dbbb8`, `9a8df40`, `af09234`). Commit: fourth tier-style closure commit.

## Automation

| Check | Result | Notes |
| --- | --- | --- |
| `vitest-axe` (`src/components/*.a11y.test.tsx`, 5 files / 6 tests) | **passing** | Component-level coverage only (~30–40% of real-world issues). `color-contrast` disabled in jsdom. **Not sufficient for full conformance sign-off.** |
| `src/test/contrast.test.ts` | **passing** | Reads the real tokens from `index.css` and asserts WCAG ratios per theme (text ≥4.5:1, focus/borders/status fills ≥3:1, timeline fills + labels). Fails if a token drifts (e.g. dark amber used on cream = ~2:1). |
| Real-browser axe (all rules incl. contrast, wcag2a–wcag22aa + best-practice) | **0 violations** | `/`, `/trials`, `/trials` (timeline), `/literature`, `/ask` (with an answer), trial dialog; light and dark; 1280, 390 and 320px. Mocked API data. Not in CI (Playwright is not a project dependency). |

## Criterion disposition

| WCAG | Scope | Result | Evidence |
| --- | --- | --- | --- |
| **2.2.2** Pause, Stop, Hide (A) | Landing-page candle | **Pass** | The candle flickers and a soft glow follows scroll. One labelled button ("Pause animation", `aria-pressed`, remembered in `localStorage`) stills the flicker and freezes the glow; it is the first control after the hero actions. `prefers-reduced-motion` removes all motion and hides the button. Verified in a real browser: pausing leaves zero running candle animations and the glow variable stops following scroll. The loading dots elsewhere are ephemeral request feedback. |
| **2.3.1** Three Flashes or Below Threshold (A) | Candle flicker | **Pass** | Every looping animation has a period of at least 4s and alternates (half-cycles >= 2s, far below three per second); the glow's opacity swing is <= 0.15; keyframes only touch transform/opacity. `src/test/candle-motion.test.ts` parses the stylesheet and fails if any limit is exceeded (mutation-checked). |
| **2.3.3** Animation from Interactions (AAA, advisory) | Reduced motion | **Pass** | `prefers-reduced-motion` gates Framer Motion in App, views, ChatMessage, snapshots, timeline, cards/rows. Global CSS reduces transitions/scroll-behavior. |
| **1.4.10** Reflow (AA) | 320px width | **Pass (manual)** | Routes and overlays use fluid widths, wrapping chips/buttons, scrollable dialog bodies. Sticky bars use `NAV_OFFSET_CLASS` + flexible layout. Verified in a real browser at 320px: no horizontal page scroll in either theme (the wordmark collapses to the icon below 420px). |
| **1.4.12** Text Spacing (AA) | 200% spacing overrides | **Pass (manual)** | `.a11y-text-spacing` utility available; controls use `min-h-11`; chips and labels allow wrap. |
| **2.4.11** Focus Not Obscured (AA) | Sticky/fixed chrome | **Pass** | One global `:focus-visible` rule (2px solid outline, ≥3:1 in both themes, survives forced-colors) with `scroll-margin-top: calc(var(--nav-offset) + 12px)`. Do not add per-component focus classes; they override it. `#main-content` retains nav offset. |
| **1.3.1** Info and Relationships (A) | Heading structure | **Pass** | Persistent route `<h1>` on `/ask` (including after first message). Home, trials, literature retain single h1. |
| **2.5.8** Target Size (AA) | Icon/compact controls | **Pass** | All interactive controls ≥44×44 (checked per route in a real browser). Desktop timeline bars are pointer-only duplicates (`aria-hidden`, `tabIndex=-1`) of the 44px row buttons; the chart scroller is a focusable labelled region (2.1.1). |
| **3.3.1 / 3.3.3** Error Identification / Suggestion (A) | Form validation | **N/A (decision)** | No client-side field validation on search/filter inputs. |
| **4.1.3** Status Messages (AA) | Async errors/status | **Pass** | Ask: an always-mounted `role="status"` polite region (in the composer) announces "Generating answer.", then the finished answer text once (or the error), never per-token deltas; the log is `aria-live="off"` and the loading indicator is an empty `role="status"`. **Unverified in screen readers** (see residual risks). Empty submit **prevented** (disabled send, no error text). Publication overview errors use `role="status"` with retry guidance. |
| **1.4.1** Use of Color (A) | Status signaling | **Pass** | `StatusBadge` uses a text label plus a distinct marker shape per tier; timeline legend, desktop rows and mobile bars carry the same marker shapes, plus status in the accessible name. Toggles expose `aria-pressed` + descriptive `aria-label`. |
| **4.1.2 / 2.4.3** (A) | Stacked overlays | **Pass** | Page shell `inert` when any overlay open; non-topmost dialog gets `aria-hidden` + `inert` via DOM attribute; focus trap on topmost layer. |

## Landing page decisions (documented)

- **Audience**: CHM causes night blindness and tunnel vision, so many visitors are low-vision. The page is one linear column, rem-based type (body 18px, scales with browser/OS text size), ~40rem measure, no tiny mono labels except the glossary badges (enlarged to ~15px there).
- **Forced colours / `prefers-contrast: more`**: the glow layer is removed; in forced colours the candle is redrawn as a system-colour line drawing (verified by screenshot).
- **Glow contrast**: the glow is a fixed 12% alpha tint behind content; `contrast.test.ts` checks text, muted, accent, borders and focus on the tinted surface in both themes, and real-browser axe (with contrast) was clean at 0%, 50% and 100% scroll in both themes.
- **Reflow / spacing**: no overflow or clipping at 320px with the WCAG 1.4.12 text-spacing override, in both themes.
- **Live counts** never render as zeros: while loading or when the API is down the sentence is omitted and its space is reserved (CLS 0.002 with a 1.2s API delay).

## Ask panel decisions (documented)

- **Empty query**: submission prevented (`disabled` send). No error announcement required.
- **API failure**: assistant message + polite status (`Answer could not be completed.`).
- **No results**: N/A for Ask; literature empty state uses plain text.

## Residual risks (manual-only)

Automated checks in this closure pass do **not** establish full WCAG conformance. A human reviewer must complete the items below before treating accessibility as done.

1. **Color contrast (1.4.3)**: Token pairs are gated by `contrast.test.ts` and real-browser axe passed in both themes. Alpha tints and any new hardcoded colour still need a manual look.
2. **320px / 200% text spacing**: 320px verified in a real browser (no overflow); text-spacing override and 400% zoom remain manual; not in CI.
3. **Stacked overlay keyboard paths**: Focus trap covered by unit tests; full stacked open/close walkthrough remains manual QA.
4. **Full-route Lighthouse / axe**: Run on all four routes (`/`, `/trials`, `/literature`, `/ask`) in a real browser, including open overlays where applicable. Component `vitest-axe` does not substitute for route-level scans.
5. **Screen reader pass**: VoiceOver (macOS/iOS) and NVDA (Windows) walkthrough of primary flows—navigation (focus now moves to the page `<h1>` after a route change), filters, trial/publication snapshots, Ask send/receive/error (confirm the status region announces the finished answer once and not per token).
6. **Contrast at zoom on real devices**: Confirm readable contrast and no loss of functionality at **200%** and **400%** browser zoom on physical or emulated devices (not jsdom).

## Manual verification checklist (completed in closure pass)

- [x] `prefers-reduced-motion: reduce` on route transitions, nav, chat, snapshots, timeline
- [x] Keyboard tab through trials/literature with sticky filter bars
- [x] `/ask` h1 present before and after first message
- [x] Timeline legend + status in accessible names
- [x] Tab through `/trials`: every stop shows a 2px solid outline
- [x] Tooltips: open on keyboard focus and mouse hover (delayed), Escape dismisses, hoverable, never open on touch
- [x] Theme: persists across reload; stored light beats a dark OS with no flash before JS loads
- [x] Landing: animation stoppable and persisted; reduced motion, forced colours and `prefers-contrast: more` handled; guide link lands below the fixed nav; no CLS; API-down state clean; axe clean in both themes at 0/50/100% scroll
- [x] Ask: follows the stream, rests at the real bottom, does not drag after scrolling up, Jump to latest resumes
- [x] Trial → publication stacked overlay: background inert, focus in top dialog
