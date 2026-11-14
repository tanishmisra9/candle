import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The landing-page intro must never flash (WCAG 2.3.1), must finish quickly, must be stoppable
// (2.2.2) and must respect the user's motion/contrast preferences. These checks read the real
// stylesheet so tuning the animation past a safe limit fails here instead of in front of a
// photosensitive visitor.

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

const rules = [...css.matchAll(/([^{}@]*\.(?:flame|candle|intro|stage|night|reveal)[^{}]*)\{([^{}]*)\}/g)].map(
  ([, selector, body]) => ({ selector: selector.trim(), body }),
);

const keyframes = [
  ...css.matchAll(/@keyframes\s+((?:flame)-[\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g),
].map(([, name, body]) => ({ name, body }));

const toSeconds = (value: string, unit: string) => (unit === "ms" ? parseFloat(value) / 1000 : parseFloat(value));

// `animation: name duration timing delay fill`: the first time is the duration, the second the delay.
const animations = rules.flatMap(({ selector, body }) =>
  [...body.matchAll(/animation:\s*([^;]+);/g)].flatMap(([, value]) =>
    value
      .split(/,(?![^(]*\))/) // several animations, not the commas inside cubic-bezier()
      .map((part) => part.trim())
      .filter((part) => !/^none\b/.test(part))
      .map((part) => {
        const times = [...part.matchAll(/(?<![\w.-])(\d*\.?\d+)(m?s)\b/g)].map(([, v, u]) => toSeconds(v, u));
        return {
          selector,
          part,
          name: part.match(/\b(flame-[\w-]+)/)![1],
          duration: times[0],
          delay: times[1] ?? 0,
          infinite: /\binfinite\b/.test(part),
        };
      }),
  ),
);

const durationsOf = (name: string) => animations.filter((a) => a.name === name).map((a) => a.duration);

describe("intro safety limits", () => {
  it("finds the animations (guards against the parser silently matching nothing)", () => {
    expect(keyframes.map((k) => k.name)).toEqual(
      expect.arrayContaining([
        "flame-appear",
        "flame-appear-core",
        "flame-veil-out",
        "flame-draw",
        "flame-travel",
        "flame-head-fade",
        "flame-ghost-out",
        "flame-breathe",
        "flame-flicker",
      ]),
    );
    expect(animations.length).toBeGreaterThanOrEqual(15);
  });

  it("everything that plays once is finished within 5.5s (delay + duration), and the parser sees it", () => {
    const finishes = animations.filter((a) => !a.infinite).map((a) => a.delay + a.duration);
    expect(Math.max(...finishes)).toBeLessThanOrEqual(5.5);
    expect(Math.max(...finishes)).toBeGreaterThan(5); // the last reveal really is that late
  });

  it("the only loops are the flicker and the breath: period >= 4s and alternating", () => {
    const looping = animations.filter((a) => a.infinite);
    expect([...new Set(looping.map((a) => a.name))].sort()).toEqual(["flame-breathe", "flame-core-sway", "flame-flicker"]);
    for (const { part, duration } of looping) {
      expect(duration, part).toBeGreaterThanOrEqual(4);
      expect(part, part).toMatch(/\balternate\b/);
    }
  });

  it("the ember travels once, slowly (>= 2s), and the trail follows at the same pace", () => {
    for (const name of ["flame-travel", "flame-draw"]) {
      expect(durationsOf(name).length, name).toBeGreaterThan(0);
      for (const d of durationsOf(name)) expect(d, name).toBeGreaterThanOrEqual(2);
      expect(animations.filter((a) => a.name === name).every((a) => !a.infinite)).toBe(true);
    }
    expect(durationsOf("flame-travel")).toEqual(durationsOf("flame-draw"));
  });

  it("no abrupt luminance steps: the veil takes >= 0.8s and every fade-in >= 0.7s", () => {
    for (const d of durationsOf("flame-veil-out")) expect(d).toBeGreaterThanOrEqual(0.8);
    for (const d of durationsOf("flame-appear")) expect(d).toBeGreaterThanOrEqual(0.7);
    for (const d of durationsOf("flame-appear-core")) expect(d).toBeGreaterThanOrEqual(0.7);
    for (const d of durationsOf("flame-ghost-out")) expect(d).toBeGreaterThanOrEqual(0.4); // a hairline outline
    for (const d of durationsOf("flame-head-fade")) expect(d).toBeGreaterThanOrEqual(3);
  });

  it("keyframes only touch opacity, stroke-dashoffset and the flicker's transform", () => {
    for (const { name, body } of keyframes) {
      // transform is allowed only where motion is bounded and tested below: the flicker, the flame
      // growing from its wick, and the sparks.
      const transformed = ["flame-flicker", "flame-core-sway", "flame-grow", "flame-spark-rise"].includes(name);
      const allowed = transformed ? ["opacity", "transform"] : ["opacity", "stroke-dashoffset"];
      for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) {
        expect(allowed, `${name}: ${prop}`).toContain(prop);
      }
    }
  });

  it("the breath swings opacity by at most 0.15", () => {
    const breathe = keyframes.find((k) => k.name === "flame-breathe")!;
    const values = [...breathe.body.matchAll(/opacity:\s*([\d.]+)/g)].map(([, v]) => parseFloat(v));
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.15);
  });

  it("the flicker moves the flame by at most 2% and 1 degree", () => {
    const flicker = keyframes.find((k) => k.name === "flame-flicker")!;
    const scales = [...flicker.body.matchAll(/scale\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].flatMap(([, x, y]) => [+x, +y]);
    const skews = [...flicker.body.matchAll(/skewX\(\s*(-?[\d.]+)deg\s*\)/g)].map(([, d]) => Math.abs(+d));
    expect(scales.length).toBeGreaterThan(0);
    for (const s of scales) expect(Math.abs(s - 1)).toBeLessThanOrEqual(0.02);
    for (const d of skews) expect(d).toBeLessThanOrEqual(1);
  });
});

describe("content is only ever made transparent, never removed", () => {
  it("no gated rule hides content from layout or assistive technology", () => {
    const gated = rules.filter(({ selector }) => /\.reveal|data-ignite="idle"/.test(selector));
    expect(gated.length).toBeGreaterThan(0);
    for (const { selector, body } of gated) {
      expect(body, selector).not.toMatch(/display:\s*none|visibility:\s*hidden|content-visibility|pointer-events:\s*none/);
    }
  });
});

describe("motion preferences", () => {
  it("paused state removes every animation", () => {
    const paused = rules.find(({ selector }) => selector.includes('data-candle-motion="paused"'));
    expect(paused?.body).toMatch(/animation:\s*none/);
  });

  it("reduced motion removes every animation", () => {
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.intro \*[^{}]*\{([^{}]*)\}/);
    expect(reduced?.[1]).toMatch(/animation:\s*none/);
  });

  it("forced colours: still system-colour outline; nothing animated or transparent", () => {
    const block = css.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(block).toMatch(/\.intro \*[^{}]*\{[^}]*animation:\s*none/);
    expect(block).toMatch(/\.intro \.reveal[^{}]*\{[^}]*opacity:\s*1\s*!important/);
    expect(block).toMatch(/CanvasText/);
    expect(block).toMatch(/\.flame-head[^{}]*\{[^}]*display:\s*none/);
  });

  it("forced-colors / more-contrast drop the room glow and the light pool", () => {
    expect(css).toMatch(/@media \(forced-colors: active\), \(prefers-contrast: more\)\s*\{\s*\.candle-room-glow, \.stage-light \{ display: none; \}/);
  });

  it("the room glow never captures input, stays behind content, with a capped alpha", () => {
    const glow = rules.find(({ selector, body }) => selector.endsWith(".candle-room-glow") && body.includes("position: fixed"))!;
    expect(glow.body).toMatch(/pointer-events:\s*none/);
    expect(glow.body).toMatch(/z-index:\s*-1/);
    expect(glow.body).toMatch(/rgb\(var\(--flame-glow\) \/ 0\.12\)/); // keep in sync with contrast.test.ts
  });

  it("the inner flame's sway stays within 10% scale and 3 degrees", () => {
    const sway = keyframes.find((k) => k.name === "flame-core-sway")!;
    const scales = [...sway.body.matchAll(/scale\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].flatMap(([, x, y]) => [+x, +y]);
    for (const v of scales) expect(Math.abs(v - 1)).toBeLessThanOrEqual(0.1);
    const skews = [...sway.body.matchAll(/skewX\(\s*(-?[\d.]+)deg\s*\)/g)].map(([, d]) => Math.abs(+d));
    expect(Math.max(...skews)).toBeLessThanOrEqual(3);
  });

  it("grow and sparks are bounded: the flame starts at >= 0.5 scale, sparks rise <= 8px, once", () => {
    const grow = keyframes.find((k) => k.name === "flame-grow")!;
    const scales = [...grow.body.matchAll(/scale\(\s*([\d.]+)\s*\)/g)].map(([, v]) => +v);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.5);
    const spark = keyframes.find((k) => k.name === "flame-spark-rise")!;
    const rises = [...spark.body.matchAll(/,\s*(-?[\d.]+)px\)/g)].map(([, v]) => Math.abs(+v));
    expect(Math.max(...rises)).toBeLessThanOrEqual(8);
    expect(animations.filter((a) => /flame-(grow|spark-rise)/.test(a.name)).every((a) => !a.infinite)).toBe(true);
  });

  it("the logo cross-fades its colours on a theme flip, and reduced motion turns that off", () => {
    expect(css).toMatch(/html\.theme-switching \.flame-logo \* \{ transition: var\(--logo-fade\) !important; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*html\.theme-switching \.flame-logo \* \{ transition: none !important; \}/);
  });

  it("the light pool never captures input and its alpha is capped at 0.28", () => {
    const pool = rules.find(({ selector, body }) => selector.endsWith(".stage-light") && body.includes("radial-gradient"))!;
    expect(pool.body).toMatch(/pointer-events:\s*none/);
    expect(pool.body).toMatch(/rgb\(var\(--flame-glow\) \/ 0\.28\)/); // keep in sync with contrast.test.ts
  });
});
