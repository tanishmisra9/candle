# ADA Pre-Merge Closure Sign-Off

Closure pass for remaining WCAG gaps flagged after the tiered ADA work (`d5dbbb8`, `9a8df40`, `af09234`). Commit: fourth tier-style closure commit.

## Automation

| Check | Result | Notes |
| --- | --- | --- |
| `vitest-axe` (`src/components/*.a11y.test.tsx`) | **6/6 passing** | `color-contrast` rule disabled in jsdom (documented limitation). Contrast remains manual-only. |

## Criterion disposition

| WCAG | Scope | Result | Evidence |
| --- | --- | --- | --- |
| **2.2.2** Pause, Stop, Hide (A) | Auto-moving/updating content | **N/A** | No carousels, marquees, or auto-updating regions that run >5s without user control. Pending dots are ephemeral request feedback, not persistent auto-motion. |
| **2.3.3** Animation from Interactions (AAA, advisory) | Reduced motion | **Pass** | `prefers-reduced-motion` gates Framer Motion in App, views, GlassNav, ChatMessage, snapshots, timeline, cards/rows. Global CSS reduces transitions/scroll-behavior. |
| **1.4.10** Reflow (AA) | 320px width | **Pass (manual)** | Routes and overlays use fluid widths, wrapping chips/buttons, scrollable dialog bodies. Sticky bars use `NAV_OFFSET_CLASS` + flexible layout. |
| **1.4.12** Text Spacing (AA) | 200% spacing overrides | **Pass (manual)** | `.a11y-text-spacing` utility available; glass controls use `min-height` on narrow viewports; pills/inputs allow wrap. |
| **2.4.11** Focus Not Obscured (AA) | Sticky/fixed chrome | **Pass** | `:focus-visible` and `.focus-ring` use `scroll-margin-top: calc(var(--nav-offset) + 12px)`. `#main-content` retains nav offset. |
| **1.3.1** Info and Relationships (A) | Heading structure | **Pass** | Persistent route `<h1>` on `/ask` (including after first message). Home, trials, literature retain single h1. |
| **2.5.8** Target Size (AA) | Icon/compact controls | **Pass** | Send/pagination 48×48; close buttons 48×48; timeline bars ≥24px tall with status in name; spacing exception documented—adjacent timeline bars do not qualify. |
| **3.3.1 / 3.3.3** Error Identification / Suggestion (A) | Form validation | **N/A (decision)** | No client-side field validation on search/filter inputs. |
| **4.1.3** Status Messages (AA) | Async errors/status | **Pass** | Ask: `role="status"` live region + conversation log; empty submit **prevented** (disabled send, no error text). Publication overview errors use `role="status"` with retry guidance. |
| **1.4.1** Use of Color (A) | Status signaling | **Pass** | `StatusBadge` uses text labels; timeline adds visible legend + status in `aria-label`/title. Toggles expose `aria-pressed` + descriptive `aria-label`. |
| **4.1.2 / 2.4.3** (A) | Stacked overlays | **Pass** | Page shell `inert` when any overlay open; non-topmost dialog gets `aria-hidden` + `inert` via DOM attribute; focus trap on topmost layer. |

## Ask panel decisions (documented)

- **Empty query**: submission prevented (`disabled` send). No error announcement required.
- **API failure**: assistant message + polite status (`Answer could not be completed.`).
- **No results**: N/A for Ask; literature empty state uses plain text.

## Residual risks (manual-only)

1. **Color contrast (1.4.3)**: Not verified by axe in jsdom; manual token review only.
2. **320px / 200% text spacing**: Verified manually in closure pass; not in CI.
3. **Stacked overlay keyboard paths**: Focus trap covered by unit tests; full stacked open/close walkthrough remains manual QA.

## Manual verification checklist (completed in closure pass)

- [x] `prefers-reduced-motion: reduce` on route transitions, nav, chat, snapshots, timeline
- [x] Keyboard tab through trials/literature with sticky filter bars
- [x] `/ask` h1 present before and after first message
- [x] Timeline legend + status in accessible names
- [x] Trial → publication stacked overlay: background inert, focus in top dialog
