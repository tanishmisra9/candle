# ADA Pre-Merge Closure Sign-Off

Closure pass for remaining WCAG gaps flagged after the tiered ADA work (`d5dbbb8`, `9a8df40`, `af09234`). Commit: fourth tier-style closure commit.

## Automation

| Check | Result | Notes |
| --- | --- | --- |
| `vitest-axe` (`src/components/*.a11y.test.tsx` and `src/views/HomeView.a11y.test.tsx` and `src/views/InfoViews.a11y.test.tsx` for /guide and /about, 7 files / 9 tests) | **passing** | Component-level coverage only (~30–40% of real-world issues). `color-contrast` disabled in jsdom. **Not sufficient for full conformance sign-off.** |
| `src/test/contrast.test.ts` | **passing** | Reads the real tokens from `index.css` and asserts WCAG ratios per theme (text ≥4.5:1, focus/borders/status fills ≥3:1, timeline fills + labels). Fails if a token drifts (e.g. dark amber used on cream = ~2:1). |
| Real-browser axe (all rules incl. contrast, wcag2a–wcag22aa + best-practice) | **0 violations** (re-run after the intro rewrite, the liquid-glass nav and the lazy-route changes) | `/`, `/trials`, `/literature`, `/ask` (empty state); light and dark; 1280, 390 and 320px; scrolled to 0 and 500px (so content passes under the glass nav), real local API data, no horizontal overflow at any combination. **Not re-run since the earlier pass:** the trials timeline view, `/ask` with an answer and the trial dialog (they were clean then). Wait >= 1.5s after scrolling before scanning: cards reveal on scroll, and axe samples them mid-fade (a false contrast failure). Not in CI (Playwright is not a project dependency). |

## Criterion disposition

| WCAG | Scope | Result | Evidence |
| --- | --- | --- | --- |
| **2.2.2** Pause, Stop, Hide (A) | Landing-page motion | **Partial (owner decision)** | The intro lasts about 2.1s, plays on every page load and any key, pointer, wheel, touch or user focus skips it. After it, the flame flicker and the inner flame's sway loop indefinitely (slow, alternating, bounded by tests). The "Pause animation" button was removed at the owner's request, so the only way to stop the loops is `prefers-reduced-motion` (which removes all motion). Strictly, 2.2.2 asks for a pause/stop/hide mechanism for motion that lasts over 5s alongside other content. Restore the button, or make the loops finite, to close this. The loading dots elsewhere are ephemeral request feedback. |
| **2.3.1** Three Flashes or Below Threshold (A) | Landing intro | **Pass** | Only slow monotonic ramps: the dusk veil lifts over 1.2s as one ramp (it is a single dim-to-bright change, never repeated), every fade takes >= 0.4s, the flame zooms in once over 1s; the only loops are the flame flicker (<= 2% / 1 degree) and the inner flame's sway (<= 10% / 3 degrees), both >= 4s and alternating. `src/test/candle-motion.test.ts` parses the stylesheet, delays included, and fails if any limit is exceeded or the intro runs past 2.8s. Not re-measured frame by frame since the 2.1s rewrite. |
| **2.1.1 / 2.4.7** Keyboard / Focus Visible (A, AA) | Content revealed after the intro | **Pass** | Gated content is only transparent, so it is focusable, but a focus ring on a transparent control would be invisible. Any `keydown` (including the first Tab) or user `focusin` skips to the finished page first, so the focused control is always fully visible (verified: after Tab the focused element is visible with a solid outline). Route-change focus on the heading is not treated as input. |
| **1.3.2 / 4.1.2** Meaningful Sequence / Name, Role, Value | Gated content in the accessibility tree | **Pass (Chromium); iOS VoiceOver unverified** | `.reveal` content is never `display:none`, `visibility:hidden`, `aria-hidden` or `inert`: it is in the accessibility snapshot and layout from t=0 (found by role while the room is dark). The intro cannot hide content for long: 1s fallback to the finished page if the logo never becomes half visible (tested at a 320x80 viewport, the 400%-zoom case). |
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

- **Audience**: CHM causes night blindness and tunnel vision, so many visitors are low-vision or find dark screens hard. The intro starts dim on purpose (the owner chose it): near-black in the dark theme, a deep warm umber in the light theme, with the flame visible and the whole page restored to normal within about 2.1s. Mitigations: any input skips it, it never hides content from the accessibility tree, it is a single monotonic lift (no flashing), and the 1s fallback shows the finished page if the logo is never half visible. There is no pause control (owner decision, see 2.2.2) and no placeholder outline before the zoom. It replays on every page load (owner decision), which is harder on these visitors than once per session. A gentler-dusk variant (lifted start colour) is the fallback if feedback says it is too dark.
- **Light theme**: the hero follows the theme (a permanently dark panel under the light nav looked bad). The page starts in a deep warm umber veil, then lifts to paper as the flame zooms in and its warm pool appears, then the content fades in. Flame colours and text on the lifting veil are checked in `contrast.test.ts` (text >= 4.5:1 once the veil is nearly gone).
- **Forced colours / `prefers-contrast: more`**: the room glow and light pool are removed; in forced colours the logo is a still `CanvasText` outline, nothing is animated or transparent (verified).
- **Contrast on the lit stage**: `contrast.test.ts` checks text, muted, accent and the focus ring on the dark canvas tinted by the light pool at its maximum alpha (0.28); bordered controls on the stage have opaque backgrounds (verified in the browser) so their borders never sit on the pool. Real-browser axe (with contrast) is clean after the intro in both themes at 1280/390/320.
- **Reflow / spacing**: no overflow at 320px; text-spacing override checked earlier on the page.
- **No layout shift**: all content occupies layout from the first frame (opacity only): CLS 0.009 through the whole intro with the real backend. The lazy-route fallback is a full viewport tall so the footer cannot jump.
- **Live counts** never render as zeros: while loading or when the API is down the sentence is omitted and its space is reserved.

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
- [ ] Landing: no pause control (owner decision; see 2.2.2); reduced motion, forced colours and `prefers-contrast: more` handled; the landing hero fills (and its content fits inside) one screen at 1280x800 / 1440x900 / 390x844, with the footer below it, and /guide and /about are axe clean (no in-page hash links, so no anchor-below-the-nav case); no CLS; API-down state clean; axe clean in both themes at 0/50/100% scroll
- [x] Ask: follows the stream, rests at the real bottom, does not drag after scrolling up, Jump to latest resumes
- [x] Trial → publication stacked overlay: background inert, focus in top dialog
