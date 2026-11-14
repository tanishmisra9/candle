import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// jsdom cannot compute colour, so vitest-axe runs with `color-contrast` off. This test is the
// contrast gate: it reads the real tokens from index.css and checks WCAG 2.x ratios per theme.

type RGB = [number, number, number];

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

function readTokens(selector: RegExp): Record<string, RGB> {
  const block = css.match(selector)?.[1] ?? "";
  const tokens: Record<string, RGB> = {};
  for (const [, name, r, g, b] of block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    tokens[name] = [Number(r), Number(g), Number(b)];
  }
  return tokens;
}

const themes = {
  light: readTokens(/:root\s*\{([^}]*)\}/),
  dark: { ...readTokens(/:root\s*\{([^}]*)\}/), ...readTokens(/:root\.dark\s*\{([^}]*)\}/) },
};

function luminance([r, g, b]: RGB) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function ratio(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function blend(top: RGB, bottom: RGB, alpha: number): RGB {
  return top.map((c, i) => Math.round(c * alpha + bottom[i] * (1 - alpha))) as RGB;
}

// [foreground, background, minimum ratio]. 4.5 = body text (1.4.3), 3 = UI/graphics (1.4.11).
const pairs: Array<[string, string, number]> = [
  ["text", "canvas", 4.5],
  ["text", "panel", 4.5],
  ["muted", "canvas", 4.5],
  ["muted", "panel", 4.5],
  ["accent", "canvas", 4.5],
  ["accent", "panel", 4.5],
  ["accent-on", "accent-fill", 4.5],
  ["accent-on", "accent-fill-hover", 4.5],
  ["accent-on", "accent-fill-pressed", 4.5],
  ["success", "canvas", 4.5],
  ["success", "panel", 4.5],
  ["danger", "canvas", 4.5],
  ["danger", "panel", 4.5],
  ["line-strong", "canvas", 3],
  ["line-strong", "panel", 3],
  ["focus", "canvas", 3],
  ["focus", "panel", 3],
  ["accent-fill", "canvas", 3],
  ...["recruiting", "active", "terminated", "other"].flatMap((k): Array<[string, string, number]> => [
    [`tl-${k}`, "panel", 3],
    ["tl-text", `tl-${k}`, 4.5],
  ]),
];

describe.each(Object.entries(themes))("%s theme contrast", (_name, tokens) => {
  it.each(pairs)("%s on %s is at least %s:1", (fg, bg, min) => {
    expect(tokens[fg], `missing token --${fg}`).toBeDefined();
    expect(tokens[bg], `missing token --${bg}`).toBeDefined();
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
  });

  it("text, muted and accent hold on the frosted nav over the canvas (glass tint over canvas)", () => {
    const [r, g, b] = tokens.glass;
    const nav = blend([r, g, b], tokens.canvas, _name === "light" ? 0.6 : 0.07); // keep in sync with --glass-a in index.css
    for (const fg of ["text", "muted", "accent"]) expect(ratio(tokens[fg], nav), fg).toBeGreaterThanOrEqual(4.5);
  });

  it("accent text stays readable on its own 12% tint (selected rows, source links)", () => {
    for (const surface of ["canvas", "panel"]) {
      const tinted = blend(tokens.accent, tokens[surface], 0.12);
      expect(ratio(tokens.accent, tinted)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens.text, tinted)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The landing page's room glow tints the canvas at up to this alpha (see .candle-room-glow in
  // index.css), so text and UI colours must still pass on the tinted surface.
  it("text, muted, accent, borders and focus still pass on the room glow at its maximum alpha", () => {
    const GLOW_ALPHA = 0.12;
    for (const surface of ["canvas", "panel"]) {
      const lit = blend(tokens["flame-glow"], tokens[surface], GLOW_ALPHA);
      expect(ratio(tokens.text, lit), `text on ${surface}+glow`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens.muted, lit), `muted on ${surface}+glow`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens.accent, lit), `accent on ${surface}+glow`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens["line-strong"], lit), `line-strong on ${surface}+glow`).toBeGreaterThanOrEqual(3);
      expect(ratio(tokens.focus, lit), `focus on ${surface}+glow`).toBeGreaterThanOrEqual(3);
    }
  });
});

// The landing hero follows the page theme. The flame casts a light pool tinted by --flame-glow at up
// to this alpha (see .stage-light in index.css; candle-motion.test.ts pins the alpha).
describe.each(Object.entries(themes))("%s landing hero", (_name, t) => {
  const POOL_ALPHA = 0.28;

  it("the lit outline holds 3:1 on the canvas", () => {
    expect(ratio(t["flame-line"], t.canvas), "lit outline on canvas").toBeGreaterThanOrEqual(3);
  });


  it("text, muted, accent and the focus ring hold once the heading is fully opaque (veil <= 15% left)", () => {
    // Content starts transparent in the deep dusk; the first block is fully opaque at 1.5s, when the
    // veil (0.5-1.8s, ease-in-out) has about 10% left. Keep in sync with the timeline in index.css.
    const seen = blend(t.dusk, t.canvas, 0.15);
    expect(ratio(t.text, seen), "text").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.muted, seen), "muted").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.accent, seen), "accent").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.focus, seen), "focus").toBeGreaterThanOrEqual(3);
  });


  it("text, muted, accent and the focus ring hold on the canvas lit by the pool at full alpha", () => {
    // Not checked here: line-strong borders. Every bordered control in the hero (buttons) has its own opaque background, so its border never sits directly on the pool.
    const lit = blend(t["flame-glow"], t.canvas, POOL_ALPHA);
    expect(ratio(t.text, lit), "text").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.muted, lit), "muted").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.accent, lit), "accent").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.focus, lit), "focus").toBeGreaterThanOrEqual(3);
  });

  it("the primary button (accent fill + on-accent text) stays legible", () => {
    expect(ratio(t["accent-on"], t["accent-fill"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t["accent-fill"], t.canvas)).toBeGreaterThanOrEqual(3);
  });
});
