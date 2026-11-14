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
├── views/                 # route-level, lazy-loaded (Home, Dashboard=/trials, Literature, Ask)
├── components/            # shared UI (cards, dialogs, filters, timeline, Ask panel)
│   └── ui/                # primitives: Button, Input, ToggleButton, Tooltip, ThemeToggle
├── lib/                   # api (sole API client), a11y, motion, theme, mobile, formatters, ...
├── hooks/                 # usePageTitle, useLastSynced
├── test/                  # setup (jsdom stubs) and contrast.test.ts
└── index.css              # design tokens (both themes), focus style, base styles
```

- Trial and publication details are **overlay dialogs**, not routes. They can stack (a publication opened from a trial sits above it); `App.tsx` tracks which is topmost, marks the page `inert`, and only the topmost dialog traps focus.
- `src/lib/api.ts` is the only place that talks to the backend. `/ask/stream` is read as server-sent events (`delta`, `done`, `error`); the `done` payload is authoritative.
- Shared motion lives in `src/lib/motion.ts`; every variant collapses to a static one under `prefers-reduced-motion`.

## Design system

A restrained take on the Telogify language: paper-like, square, no pills. Keep it clinical, not poster-brutalist.

- **Shape**: `rounded-panel` (2px) on all interactive elements, 1px hairlines, no glass, blur or soft shadows. The only offset shadow is the tooltip. Tabs are underlines (`tabClass` in `lib/ui.ts`). Labels such as status, phase, NCT/PMID are mono uppercase (`.kicker`).
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

`views/HomeView.tsx` composes `components/home/*`: a hero **stage** (follows the page theme) with the huge logo, the three audience paths, a live "Candle today" sentence (reuses the Trials/Literature total queries), a glossary built from the same formatters/badges as the Trials page, a "what Candle does and doesn't do" section and a builder's note. Type is rem-based so it scales with the user's text-size setting.

**The intro.** The hero is Candle's original flame (the exact lucide `Flame` path, byte-compared in `FlameLogo.test.tsx`) at about 42svh, lighting the stage like a candle being lit, then the rest of the page appears in its light: a `--dusk` veil over the stage lifts as the flame fills, so the room brightens (light theme: warm taupe to paper; dark theme: dusk equals the near-black canvas, so only the flame and glow show). An ember travels the outline leaving amber, the flame fills (gradient + inner core) with a soft light pool, then the heading, text, actions, live line and sections fade in staggered. It takes 5.4s, once per browser session, then only a barely-there flicker and a slow breath remain.

State and gating (`components/home/useIgnition.ts`, `data-ignite` on the `.intro` wrapper):
- `IGNITE_STATES` `idle -> go -> lit` (`lit` terminal), with `ignitionNext()` as the only writer. The base CSS (no `data-ignite`) is the finished page, so every no-animation path is lit.
- It starts only when at least half of the **logo** is visible and the tab is visible; if it has not started 1.5s after mount it goes straight to `lit` (so at 400% zoom content can never stay hidden).
- Initial state is `lit` for reduced motion, a remembered pause, and anyone who has already seen it this session (`sessionStorage["candle-intro-seen"]`), read in the `useState` initializer so the first render is right.
- Any `keydown`, `pointerdown`, `wheel`, `touchstart` or user `focusin` skips to `lit` (so the first Tab press reveals everything and the focus ring lands on a visible control). The route-change focus `PageTransition` puts on `[data-route-heading]`/`#main-content` is not input and must not skip.
- Gated elements (`.reveal`) are only made transparent: never `display:none`, `visibility:hidden`, `aria-hidden` or `inert`, so they stay in the accessibility tree and in layout (no shift). The stop control is first in the stage and never gated.
- Limits (tested in `src/test/candle-motion.test.ts`, which parses `index.css` including delays): everything non-looping finishes within 5.5s; the ember travels once over >= 2s; the veil takes >= 0.8s and fades >= 0.7s; the only loops are the flicker and breath (period >= 4s, alternating, flicker <= 2% / 1 degree, breath swing <= 0.15); keyframes only touch opacity, stroke-dashoffset and the flicker's transform. Change an animation and run the test.
- The unlit outline uses `--line-strong` (>= 3:1) so the logo is never invisible before it lights. `contrast.test.ts` checks the stage palette and text on the light pool at its maximum alpha (0.28); bordered controls on the stage have opaque backgrounds (their borders never sit on the pool).
- `forced-colors`: still `CanvasText` outline, nothing animated or transparent; `forced-colors` and `prefers-contrast: more` also remove the room glow and the pool.
- **Do not put a CSS `transform` on the route wrapper** (`PageTransition` is opacity-only, pinned by `lib/motion.test.ts`): a transform makes it the containing block for `position: fixed` children, so the Ask composer and the scroll-to-top button rendered mid-screen and then jumped.
- Real-browser axe scans must set `sessionStorage["candle-intro-seen"]="1"` (or wait for the intro to finish): mid-intro the content is deliberately transparent.
- Disease background and glossary wording are cited/derived from MedlinePlus Genetics and NEI and should be reviewed by the owner before changes.

## Accessibility rules

Accessibility is the top requirement for this app. Closure notes and what still needs a human are in [`docs/ADA_CLOSURE.md`](docs/ADA_CLOSURE.md).

- **Focus**: one global `:focus-visible` outline (2px, >= 3:1). Do not add per-component `focus-visible:outline-none` or ring classes; they override it.
- **Targets**: interactive controls are at least 44x44px.
- **Status is never colour alone**: `StatusBadge` and the timeline pair colour with a marker shape and text.
- **Headings**: one `<h1>` per page; card/row titles are `<h2>`. After a client-side navigation focus moves to the new `<h1>` (`PageTransition`).
- **Tooltips** (`components/ui/Tooltip.tsx`) are supplementary: open on mouse hover (delayed) and keyboard focus, dismiss with Escape, stay open while hovered, and never open on touch. The trigger must be a focusable element and must **not** be inside another interactive element (cards are single `<button>`s). Never put essential information only in a tooltip.
- **Ask announcements**: the conversation log is `aria-live="off"`; one always-mounted polite status region announces "Generating answer", then the finished answer once.
- **Ask scroll** (`components/AskPanel.tsx`): the page scrolls on `window`. Following the stream uses a ref derived from position (within 80px of the bottom), ignores scrolls it caused itself, and scrolls to the true document bottom, not a sentinel above the padding. Do not make a scroll-written state an effect dependency: that caused an infinite scroll glitch.

## Verifying changes

`vitest-axe` runs with `color-contrast` off because jsdom cannot compute colour or layout, so some checks need a real browser.

- **Contrast gate**: `src/test/contrast.test.ts` reads the tokens from `index.css` and asserts WCAG ratios for every pair in both themes. Change a colour, run `pnpm test`.
- **Real-browser axe**: run axe-core (`node_modules/axe-core/axe.min.js`, all WCAG tags plus best-practice) on each route in both themes at 1280, 390 and 320px, including open dialogs and the timeline view. Also check no horizontal overflow and that targets are >= 44px.
- **Ask scroll**: mock `/ask/stream` (override `window.fetch` in an init script) to stream long markdown slowly, then assert: it follows while at the bottom; one second after scrolling to the real bottom `scrollHeight - scrollY - innerHeight <= 4`; after a wheel-up mid-stream `scrollY` does not change as tokens arrive; "Jump to latest" resumes following. Run at 1280x800 and 390x844 and confirm it fails against the previous commit.
- **Theme**: with a stored theme opposite to the OS theme, `<html>` has the stored class before the JS bundle loads (delay `main.tsx` in the test).
- **Screen readers** (VoiceOver, NVDA) and 400% zoom are manual; see `docs/ADA_CLOSURE.md`.

Playwright is not a project dependency; run it from a scratch directory (`npx playwright`). In zsh an unquoted variable is not word-split, so pass viewport arguments explicitly.
