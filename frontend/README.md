# Candle frontend

React 18 + TypeScript + Vite + Tailwind 3 SPA (Framer Motion, TanStack Query, React Router). Dark and light themes. Deployed to Vercel as a SPA (`vercel.json` rewrites everything to `index.html`).

```bash
pnpm install
pnpm dev          # Vite on :5173 (needs the backend on :8000, or set VITE_API_BASE_URL)
pnpm test         # vitest: unit, component, vitest-axe and colour-contrast tests
pnpm run build    # tsc -b && vite build; the typecheck is part of the build
```

If you edit `package.json`, regenerate `pnpm-lock.yaml` in the same change (`pnpm install`). CI runs `pnpm install --frozen-lockfile`.

## Structure

```text
src/
├── main.tsx, App.tsx      # entry; shell, routes, stacked snapshot overlays
├── views/                 # route-level (Home is bundled with the shell; Dashboard=/trials, Literature, Ask, Guide, About are lazy)
├── components/            # shared UI (cards, dialogs, filters, timeline, Ask panel)
│   ├── home/              # the landing page: FlameLogo, useIgnition (intro state), the live counts sentence
│   └── ui/                # primitives: Button, Input, ToggleButton, Tooltip, ThemeToggle
├── lib/                   # api (sole API client), routes (lazy chunks + prefetch), a11y, motion, theme, mobile, formatters, ...
├── hooks/                 # usePageTitle, useLastSynced
├── test/                  # setup (jsdom stubs) and contrast.test.ts
└── index.css              # design tokens (both themes), focus style, base styles
```

- Trial and publication details are **overlay dialogs**, not routes. They can stack (a publication opened from a trial sits above it); `App.tsx` tracks which is topmost, marks the page `inert`, and only the topmost dialog traps focus.
- `src/lib/api.ts` is the only place that talks to the backend. `/ask/stream` is read as server-sent events (`delta`, `done`, `error`); the `done` payload is authoritative.
- Shared motion lives in `src/lib/motion.ts`; every variant collapses to a static one under `prefers-reduced-motion`.

## Design system

A restrained take on the Telogify language: paper-like, square, no pills. Keep it clinical, not poster-brutalist.

- **Shape**: `rounded-panel` (2px) on all interactive elements, 1px hairlines, no glass, blur or soft shadows (except the nav, an Apple-style "liquid glass" bar: `.site-nav::before` = backdrop blur+saturate, tint lighter at the top (`--glass*` tokens), specular inner rim; `::after` = static sheen; header = 1px hairline + soft shadow. Chromium also refracts the bottom edge via an SVG displacement filter (`html[data-refract]`, set in index.html; Safari/Firefox accept `backdrop-filter: url()` and render nothing, and `@supports` cannot detect it, so it is gated on the engine). Opaque under `prefers-reduced-transparency`/`prefers-contrast: more`/forced colours or without backdrop-filter. `contrast.test.ts` checks text on it over worst-case content. Shape stays a square full-width bar. Note: Playwright's WebKit does not render backdrop-filter even in a trivial page, so Safari's look can only be judged by the user; keep the mask OFF the header itself or it hides the active-tab underline). The only offset shadow is the tooltip. Tabs are underlines (`tabClass` in `lib/ui.ts`). Labels such as status, phase, NCT/PMID are mono uppercase (`.kicker`).
- **Themes** are class-based (`.dark` on `<html>`). Colours are RGB-channel CSS variables in `src/index.css` (`:root` = light paper, `:root.dark`) exposed as Tailwind tokens with alpha support (`bg-accent/10`).
  - `text`, `muted`, `canvas`, `panel`: content and surfaces.
  - `line` is decorative hairlines; **control borders use `line-strong`** (>= 3:1).
  - `accent` is for text/indicators; `accent-fill` + `accent-on` are for button surfaces. They differ because dark-theme amber is about 2:1 on cream.
  - `success`, `danger`, `--tl-*` (timeline) have per-theme values.
- **Never hardcode `rgba()` or hex in a component.** `rg "rgba\(|#[0-9a-fA-F]{6}" src --glob '*.tsx'` should return nothing.
- **Tailwind gotcha**: named tokens are emitted alphabetically, so a class you add later in a `clsx` does not necessarily beat a primitive's own class (`border-line-strong` beats `border-accent`). Override shared-primitive colours with `!` modifiers and confirm with `getComputedStyle` in a browser.
- **Theme switches are flash-free**: `setTheme` adds `html.theme-switching` (`transition: none !important`) around the flip and removes it two frames later, otherwise `transition-colors` controls fade for ~140ms behind the instantly-changed page. Only transitions are suppressed; animations are unaffected.
- **No theme flash**: an inline script in `index.html` sets the class, `color-scheme` and `theme-color` before first paint from `localStorage["candle-theme"]` or the OS. Keep `--canvas` in sync in `index.css`, that script, and `THEME_COLORS` in `lib/theme.ts`.

## Landing page

`views/HomeView.tsx` composes `components/home/*` into **one screen**: a hero **stage** (follows the page theme) with the logo, a welcome, the three main destinations and a live "Candle today" sentence (reuses the Trials/Literature total queries). Everything else lives on its own page: the CHM and trial-terms guide on `/guide` (`views/GuideView.tsx`, built from the same formatters/badges as the Trials page) and the limits and builder's note on `/about`; both are linked from the footer, which also carries the "does not give medical advice" line on every page that has a footer. There are no in-page hash links. Type is rem-based so it scales with the user's text-size setting.

**The hero fills at least one screen, with room to breathe.** The stage is `min-height: 100svh` inside an app shell that is a flex column (root > page content > `<main>`), so on a taller screen it grows to fill the page and nothing hard-codes the nav or footer heights; when its content is taller (1280x800, phones) it simply grows and the page scrolls a little. The flame is sized from the screen height (about 33svh, about 20svh on phones, never under 8rem / 7rem). Under the hero, `components/home/NextSteps.tsx` gives the Guide and About pages a two-tile band (title and one line; an accent outline around the whole tile on hover or focus; the footer drops its small links on `/` so they are not repeated, and on `/guide` and `/about` it leaves out the link to the page you are on). The inner pages have Telogify's icon-only back arrow ("Back to home") above the heading.

**Top to bottom, footer last.** The band is the intro's 6th reveal block and the footer (outside the intro wrapper) follows through the `data-ignite` attribute mirrored onto `<html>` (`.footer-reveal` in `index.css`): counts 1.38s, band 1.5s, footer 1.62s, all done before the intro ends at 2.3s. On every other page the footer fades in 0.5s after load, after the page's own cascade. Reduced motion shows everything at once. `/guide` and `/about` are deliberately short: a three-step phase track, a three-column status legend (the same markers as trial cards), and a two-column does/doesn't panel.

**The intro.** The hero is Candle's original flame (the exact lucide `Flame` path, byte-compared in `FlameLogo.test.tsx`). One simple sequence of about 2.1s plays on every page load (not on an in-app return to `/`): the flame zooms in while the room lifts out of a dusk veil (light theme: deep warm umber to paper; dark theme: dusk equals the canvas), a soft light pool blooms, and the page fades in top to bottom. Afterwards only a barely-there flicker and the inner flame's slow sway remain. The veil is `html[data-ignite]::before`; `index.html` starts it before first paint so the nav never flashes bright.

State and gating (`components/home/useIgnition.ts`, `data-ignite` on the `.intro` wrapper and on `<html>`):
- `IGNITE_STATES` `idle -> go -> hurried -> lit` (`lit` terminal), with `ignitionNext()` as the only writer. `hurried` is `go` after a scroll, touch or click mid-reveal: the finite CSS animations run 5x faster so the rest reveals quickly, still top to bottom; the DOM and CSS see it as `go`, and it is never paused while the logo is off screen. The base CSS (no `data-ignite`) is the finished page, so every no-animation path is lit.
- It starts only when at least half of the **logo** is visible and the tab is visible; if it has not started 1s after mount it goes straight to `lit` (so at 400% zoom content can never stay hidden). `go` settles to `lit` after 2.3s.
- Initial state is `lit` for reduced motion and for an in-app return to `/` (module flag, not storage, so a reload replays).
- A `keydown` or user `focusin` skips to `lit` at once (Tab must land on a visible control); `wheel`, `touchstart` and `pointerdown` hurry the rest of the intro instead of snapping it (before it has started, they settle to `lit` at once). The focus a press itself causes is not a Tab. The route-change focus `PageTransition` puts on `[data-route-heading]`/`#main-content` is not input and must not skip.
- Gated elements (`.reveal`) are only made transparent: never `display:none`, `visibility:hidden`, `aria-hidden` or `inert`, so they stay in the accessibility tree and in layout (no shift). There is deliberately no pause button (owner decision); see `docs/ADA_CLOSURE.md` row 2.2.2 for the consequence.
- Limits (tested in `src/test/candle-motion.test.ts`, which parses `index.css` including delays): everything non-looping finishes within 2.8s; the veil lifts over >= 1.2s; fades >= 0.4s; the zoom starts at >= 0.5 scale; the only loops are the flicker and the inner sway (period >= 4s, alternating, bounded); keyframes only touch opacity and bounded transforms. Change an animation and run the test.
- The loops use one identical declaration in `go` and `lit`; two different rules restart the animation at the switch and the inner flame snaps. The body, inner flame and outline share one flickering group so the inner flame never drifts against the outline.
- `contrast.test.ts` checks the hero palette in both themes (outline on canvas, text once the veil is nearly gone, text on the light pool at its maximum alpha 0.28).
- `forced-colors`: still `CanvasText` outline, nothing animated or transparent; `forced-colors` and `prefers-contrast: more` also remove the veil, the room glow and the pool.
- **Do not put a CSS `transform` on the route wrapper** (`PageTransition` is opacity-only, pinned by `lib/motion.test.ts`): a transform makes it the containing block for `position: fixed` children, so the Ask composer and the scroll-to-top button rendered mid-screen and then jumped.
- Real-browser axe scans must wait for `data-ignite="lit"` (about 2.5s): mid-intro the content is deliberately transparent.
- **Loading**: Home is bundled eagerly; other routes are lazy but prefetched (`lib/routes.ts`: nav hover/focus/touch and an idle pass). The route fallback shows nothing for 250ms and never text. Pages fade in top to bottom (`.page-cascade`, opacity only). Inter is self-hosted (`@fontsource-variable/inter`) with a metrics-matched fallback.
- Disease background and glossary wording (now in `views/GuideView.tsx`) are cited/derived from MedlinePlus Genetics and NEI and should be reviewed by the owner before changes.

## Accessibility rules

Accessibility is the top requirement for this app. Closure notes and what still needs a human are in [`docs/ADA_CLOSURE.md`](docs/ADA_CLOSURE.md).

- **Focus**: one global `:focus-visible` outline (2px, >= 3:1). Do not add per-component `focus-visible:outline-none` or ring classes; they override it.
- **Targets**: interactive controls are at least 44x44px.
- **Status is never colour alone**: `StatusBadge` and the timeline pair colour with a marker shape and text.
- **Headings**: one `<h1>` per page; card/row titles are `<h2>`. After a client-side navigation focus moves to the new `<h1>` (`PageTransition`). A page can name one control to focus instead with `data-route-autofocus` (the Ask question box), only with a mouse-like pointer (`hover: hover and pointer: fine`) so touch devices don't get the keyboard popped over the page.
- **Tooltips** (`components/ui/Tooltip.tsx`) are supplementary: open on mouse hover (delayed) and keyboard focus, dismiss with Escape, stay open while hovered, and never open on touch. The trigger must be a focusable element and must **not** be inside another interactive element (cards are single `<button>`s). Never put essential information only in a tooltip.
- **Mobile menu** (`components/SiteNav.tsx`): below 640px the tabs become a menu button opening a full-screen dialog of the three destinations. While open, the page behind is scroll-locked (`html` and `body`) and `inert`, and the overlay stacks above the Ask composer and scroll-to-top button; focus goes to the first link and Tab cycles through the menu button and the links, pulling focus back in from anywhere else; a tap on anything that is not a link closes it; Escape closes it and returns focus to the button; it also closes on navigation, on a tap of the current page's link, and when the window grows to desktop width. The overlay is a sibling of the header (the header's backdrop-filter would otherwise shrink it to the header's height). Motion is `mobileMenuMotion` and stays still under reduced motion.
- **Ask announcements**: the conversation log is `aria-live="off"`; one always-mounted polite status region announces "Generating answer", then the finished answer once.
- **Ask scroll** (`components/AskPanel.tsx`): the page scrolls on `window`. Following the stream uses a ref derived from position (within 80px of the bottom), ignores scrolls it caused itself, and scrolls to the true document bottom, not a sentinel above the padding. Do not make a scroll-written state an effect dependency: that caused an infinite scroll glitch.
- **Ask interaction** (`components/AskPanel.tsx`, `ChatMessage.tsx`): a failed answer is its own bubble (`AskMessage.isError`) with "Try again" and "Edit question", both of which go back through `sendQuestion` (one paid call per question). `describeAskFailure` gives plain-language causes; the "check the OpenAI key" hint exists only under `import.meta.env.DEV`. While an answer is in flight Send becomes Stop: it aborts the request and never falls back to `POST /ask`. **Send and Stop must keep distinct `key`s**: sharing one slot makes React reuse a single `<button>` and flip its `type` mid-click, so the browser submits the form and re-asks the stopped question (jsdom cannot show it; the test asserts they are different elements). The composer is a full-width canvas bar with the safe-area inset; the page's single bottom padding is on the Ask root.
- **Dialogs** (`TrialSnapshot`, `PublicationSnapshot`): the panel stays `relative` (sr-only text inside an unpositioned `overflow-hidden` panel would otherwise extend the fixed overlay's scroll height). A dialog stacked on another shows "Back to ..." (`StackBackButton`, driven by the `underneath` prop from `App.tsx`).
- **Icon-only buttons**: use `!p-0`, not `p-0` (a `Button` variant's own `px-5` outranks it and squeezes the icon).
- **Data states**: a count is shown only once a response exists: the page heading stays invisible until the number is final, then blurs in once (`CountHeading`; it falls back to plain "Trials" / "Literature" only on a failure), and a failed load renders ONE `ErrorPanel` instead of the list and an empty state. Unknown addresses render `NotFoundView` (catch-all route; nav tabs match exactly).
- **One source for words and numbers**: statuses come from `statusTier` / `STATUS_TIER_TITLES` (card, filters, Guide, Timeline legend); dates from `formatMonthYear` (UTC: date-only API strings otherwise print the previous month west of UTC; the test suite pins `TZ=America/Los_Angeles` to catch that); participants, citations and publication titles from `lib/formatters.ts`.
- **Touch**: `future.hoverOnlyWhenSupported` is on (restart the dev server after changing `tailwind.config.ts`), and cards, rows and buttons have `active:` feedback.
- **Phones**: on a phone the dialog's title is shown once, at the top of the scrolling body (the header is only the id and the close button); the footer keeps `max-sm:pb-20` so the floating scroll-to-top button never covers its text; the nav always shows the name.

## Verifying changes

`vitest-axe` runs with `color-contrast` off because jsdom cannot compute colour or layout, so some checks need a real browser.

- **Contrast gate**: `src/test/contrast.test.ts` reads the tokens from `index.css` and asserts WCAG ratios for every pair in both themes. Change a colour, run `pnpm test`.
- **Real-browser axe**: wait >= 1.5s after any scroll before scanning (cards reveal on scroll and axe reports a false contrast failure mid-fade), and for the landing page wait for the intro (about 2.5s). Run axe-core (`node_modules/axe-core/axe.min.js`, all WCAG tags plus best-practice) on each route in both themes at 1280, 390 and 320px, including open dialogs and the timeline view. Also check no horizontal overflow and that targets are >= 44px.
- **Ask scroll**: mock `/ask/stream` (override `window.fetch` in an init script) to stream long markdown slowly, then assert: it follows while at the bottom; one second after scrolling to the real bottom `scrollHeight - scrollY - innerHeight <= 4`; after a wheel-up mid-stream `scrollY` does not change as tokens arrive; "Jump to latest" resumes following. Run at 1280x800 and 390x844 and confirm it fails against the previous commit.
- **Theme**: with a stored theme opposite to the OS theme, `<html>` has the stored class before the JS bundle loads (delay `main.tsx` in the test).
- **Screen readers** (VoiceOver, NVDA) and 400% zoom are manual; see `docs/ADA_CLOSURE.md`.

Playwright is not a project dependency; run it from a scratch directory (`npx playwright`). In zsh an unquoted variable is not word-split, so pass viewport arguments explicitly.
