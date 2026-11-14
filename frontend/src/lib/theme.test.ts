import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setTheme } from "./theme";

// Switching theme used to flip the page background in one frame while every `transition-colors`
// control (the Ask example questions, buttons, inputs) faded over ~140ms, so a dark page showed
// white buttons for ~9 frames. setTheme now disables transitions around the flip.

const root = document.documentElement;
let queue: Array<FrameRequestCallback | null> = [];

const flushFrame = () => {
  const batch = queue;
  queue = [];
  batch.forEach((callback) => callback?.(0));
};

beforeEach(() => {
  queue = [];
  root.classList.remove("dark", "theme-switching");
  document.head.innerHTML = '<meta name="theme-color" content="#fbf8ef" />';
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue[id - 1] = null;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("setTheme transition suppression", () => {
  it("turns transitions off before flipping the theme, and back on after two frames", () => {
    setTheme("dark");
    expect(root).toHaveClass("theme-switching");
    expect(root).toHaveClass("dark");

    flushFrame();
    expect(root).toHaveClass("theme-switching"); // one frame is not enough for the restyle to land
    flushFrame();
    expect(root).not.toHaveClass("theme-switching");
  });

  it("a quick second toggle extends the window instead of ending it early", () => {
    setTheme("dark");
    flushFrame();
    setTheme("light"); // the first call's pending removal must not fire mid-switch
    flushFrame();
    expect(root).toHaveClass("theme-switching");
    flushFrame();
    expect(root).not.toHaveClass("theme-switching");
    expect(root).not.toHaveClass("dark");
  });

  it("falls back to a timer where requestAnimationFrame is missing", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    setTheme("dark");
    expect(root).toHaveClass("theme-switching");
    vi.runAllTimers();
    expect(root).not.toHaveClass("theme-switching");
    vi.useRealTimers();
  });
});

describe("stylesheet", () => {
  it("disables every transition while the theme switches (and only transitions)", () => {
    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const rule = css.match(/html\.theme-switching[^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/transition:\s*none\s*!important/);
    expect(rule).not.toMatch(/animation/);
    expect(css).toMatch(/html\.theme-switching \*::before/);
    expect(css).toMatch(/html\.theme-switching \*::after/);
  });
});
