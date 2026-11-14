import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The landing-page logo ignition must never flash (WCAG 2.3.1), must be stoppable (2.2.2) and must
// respect the user's motion/contrast preferences. These checks read the real stylesheet so tuning
// the animation past a safe limit fails here instead of in front of a photosensitive visitor.

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

const rules = [...css.matchAll(/([^{}@]*\.(?:flame|candle)[^{}]*)\{([^{}]*)\}/g)].map(
  ([, selector, body]) => ({ selector: selector.trim(), body }),
);

const keyframes = [
  ...css.matchAll(/@keyframes\s+((?:flame|candle)-[\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g),
].map(([, name, body]) => ({ name, body }));

function seconds(token: string) {
  return token.endsWith("ms") ? parseFloat(token) / 1000 : parseFloat(token);
}

const animations = rules.flatMap(({ selector, body }) =>
  [...body.matchAll(/animation:\s*([^;]+);/g)].flatMap(([, value]) =>
    value
      .split(/,(?![^(]*\))/) // several animations, not the commas inside cubic-bezier()
      .map((part) => part.trim())
      .filter((part) => !/^none\b/.test(part))
      .map((part) => ({
        selector,
        part,
        name: part.match(/\b((?:flame|candle)-[\w-]+)/)![1],
        duration: seconds(part.match(/(\d*\.?\d+m?s)/)![1]),
      })),
  ),
);

const durationsOf = (name: string) => animations.filter((a) => a.name === name).map((a) => a.duration);

describe("logo ignition safety limits", () => {
  it("finds the animations (guards against the parser silently matching nothing)", () => {
    expect(keyframes.map((k) => k.name)).toEqual(
      expect.arrayContaining([
        "flame-appear",
        "flame-draw",
        "flame-travel",
        "flame-head-fade",
        "flame-ghost-out",
        "flame-breathe",
      ]),
    );
    expect(animations.length).toBeGreaterThanOrEqual(7);
  });

  it("the only looping animation is the slow breath: period >= 4s and alternating", () => {
    const looping = animations.filter(({ part }) => /\binfinite\b/.test(part));
    expect([...new Set(looping.map((a) => a.name))]).toEqual(["flame-breathe"]); // used by both go and lit
    for (const { part, duration } of looping) {
      expect(duration, part).toBeGreaterThanOrEqual(4);
      expect(part, part).toMatch(/\balternate\b/);
    }
  });

  it("the ember travel is one slow pass (>= 4s) and the trail follows at the same pace", () => {
    for (const name of ["flame-travel", "flame-draw"]) {
      const found = durationsOf(name);
      expect(found.length, name).toBeGreaterThan(0);
      for (const d of found) expect(d, name).toBeGreaterThanOrEqual(4);
      expect(animations.filter((a) => a.name === name).every((a) => !/\binfinite\b/.test(a.part))).toBe(true);
    }
    expect(durationsOf("flame-travel")).toEqual(durationsOf("flame-draw"));
  });

  it("no abrupt luminance steps: every fade in/out takes at least 0.7s", () => {
    for (const name of ["flame-appear", "flame-ghost-out"]) {
      for (const d of durationsOf(name)) expect(d, name).toBeGreaterThanOrEqual(0.4);
    }
    for (const d of durationsOf("flame-appear")) expect(d).toBeGreaterThanOrEqual(0.7);
    for (const d of durationsOf("flame-head-fade")) expect(d).toBeGreaterThanOrEqual(5);
  });

  it("keyframes only animate opacity and stroke-dashoffset (paint-only, on an <=80px SVG)", () => {
    for (const { name, body } of keyframes) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map(([, prop]) => prop);
      for (const prop of properties) {
        expect(["opacity", "stroke-dashoffset"], `${name}: ${prop}`).toContain(prop);
      }
    }
  });

  it("the breath swings opacity by at most 0.15", () => {
    const breathe = keyframes.find((k) => k.name === "flame-breathe")!;
    const values = [...breathe.body.matchAll(/opacity:\s*([\d.]+)/g)].map(([, v]) => parseFloat(v));
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.15);
  });
});

describe("logo motion preferences", () => {
  it("paused state removes every logo animation", () => {
    const paused = rules.find(({ selector }) => selector.includes('data-candle-motion="paused"') && selector.includes(".flame"));
    expect(paused?.body).toMatch(/animation:\s*none/);
  });

  it("reduced motion removes every logo animation", () => {
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.flame-logo \*[^{}]*\{([^{}]*)\}/);
    expect(reduced?.[1]).toMatch(/animation:\s*none/);
  });

  it("forced colours: still, system-colour line drawing, no glow or ember", () => {
    const block = css.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(block).toMatch(/\.flame-logo \*[^{}]*\{[^}]*animation:\s*none/);
    expect(block).toMatch(/CanvasText/);
    expect(block).toMatch(/\.flame-head[^{}]*\{[^}]*display:\s*none/);
  });

  it("forced-colors / more-contrast also drop the room glow", () => {
    expect(css).toMatch(/@media \(forced-colors: active\), \(prefers-contrast: more\)\s*\{\s*\.candle-room-glow \{ display: none; \}/);
  });

  it("the room glow never captures input and stays behind content with a capped alpha", () => {
    const glow = rules.find(
      ({ selector, body }) => selector.endsWith(".candle-room-glow") && body.includes("position: fixed"),
    )!;
    expect(glow.body).toMatch(/pointer-events:\s*none/);
    expect(glow.body).toMatch(/z-index:\s*-1/);
    expect(glow.body).toMatch(/rgb\(var\(--flame-glow\) \/ 0\.12\)/); // keep in sync with contrast.test.ts
  });
});
