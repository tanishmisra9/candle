import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The landing-page candle must never flash (WCAG 2.3.1), must be stoppable (2.2.2) and must respect
// the user's motion/contrast preferences. These checks read the real stylesheet so tuning the
// animation past a safe limit fails here instead of in front of a photosensitive visitor.

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

const candleRules = [...css.matchAll(/([^{}@]*\.candle[^{}]*)\{([^{}]*)\}/g)].map(
  ([, selector, body]) => ({ selector: selector.trim(), body }),
);

const keyframes = [...css.matchAll(/@keyframes\s+(candle-[\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map(
  ([, name, body]) => ({ name, body }),
);

function seconds(token: string) {
  return token.endsWith("ms") ? parseFloat(token) / 1000 : parseFloat(token);
}

describe("candle animation safety limits", () => {
  const animated = candleRules.flatMap(({ selector, body }) =>
    [...body.matchAll(/animation:\s*([^;]+);/g)].flatMap(([, value]) =>
      value
        .split(/,(?![^(]*\))/) // split multiple animations, not commas inside cubic-bezier()
        .map((part) => part.trim())
        .filter((part) => part !== "none")
        .map((part) => ({ selector, part, duration: seconds(part.match(/(\d*\.?\d+m?s)/)![1]) })),
    ),
  );

  it("finds the candle animations (guards against the parser silently matching nothing)", () => {
    expect(animated.length).toBeGreaterThanOrEqual(5);
    expect(keyframes.map((k) => k.name)).toEqual(
      expect.arrayContaining(["candle-rise", "candle-flicker-a", "candle-flicker-b", "candle-pulse"]),
    );
  });

  it("every looping animation has a period of at least 4s and alternates (half-cycles >= 2s)", () => {
    const looping = animated.filter(({ part }) => /\binfinite\b/.test(part));
    expect(looping.length).toBeGreaterThanOrEqual(3);
    for (const { part, duration } of looping) {
      expect(duration, part).toBeGreaterThanOrEqual(4);
      expect(part, part).toMatch(/\balternate\b/);
    }
  });

  it("keyframes only animate transform and opacity (compositor-friendly, no layout)", () => {
    for (const { name, body } of keyframes) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map(([, prop]) => prop);
      for (const prop of properties) {
        expect(["transform", "opacity"], `${name}: ${prop}`).toContain(prop);
      }
    }
  });

  it("the glow pulse swings opacity by at most 0.15", () => {
    const pulse = keyframes.find((k) => k.name === "candle-pulse")!;
    const values = [...pulse.body.matchAll(/opacity:\s*([\d.]+)/g)].map(([, v]) => parseFloat(v));
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.15);
  });
});

describe("candle motion preferences", () => {
  it("paused and reduced-motion states remove every candle animation", () => {
    const pausedRule = candleRules.find(({ selector }) => selector.includes('data-candle-motion="paused"'));
    expect(pausedRule?.body).toMatch(/animation:\s*none/);

    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.candle-rise[^{}]*\{([^{}]*)\}/);
    expect(reduced?.[1]).toMatch(/animation:\s*none/);
  });

  it("forced-colors / more-contrast drop the glow and redraw the candle in system colours", () => {
    expect(css).toMatch(/@media \(forced-colors: active\), \(prefers-contrast: more\)\s*\{\s*\.candle-room-glow \{ display: none; \}/);
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.candle-art \* \{ fill: none; stroke: CanvasText; \}/);
  });

  it("the room glow never captures input and stays behind content with a capped alpha", () => {
    const glow = candleRules.find(
      ({ selector, body }) => selector.endsWith(".candle-room-glow") && body.includes("position: fixed"),
    )!;
    expect(glow.body).toMatch(/pointer-events:\s*none/);
    expect(glow.body).toMatch(/z-index:\s*-1/);
    expect(glow.body).toMatch(/rgb\(var\(--flame-glow\) \/ 0\.12\)/); // keep in sync with contrast.test.ts
  });
});
