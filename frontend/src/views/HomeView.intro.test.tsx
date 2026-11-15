import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { resetIntroPlayed } from "../components/home/useIgnition";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "./HomeView";

vi.mock("../lib/api", () => ({
  listTrialsPage: vi.fn().mockResolvedValue({ items: [], next_cursor: null, total: 3 }),
  listPublicationsPage: vi.fn().mockResolvedValue({ items: [], next_cursor: null, total: 4 }),
  getSyncLastSynced: vi.fn().mockResolvedValue({ last_synced: null }),
}));

let reduced = false;
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced,
}));

// Node's experimental global storage shadows jsdom's here; use plain stubs.
const local = new Map<string, string>();
let session = new Map<string, string>();

let entry = { isIntersecting: true, intersectionRatio: 1 };
class FakeIntersectionObserver {
  constructor(private callback: (entries: unknown[]) => void) {}
  observe() {
    this.callback([entry]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const originalObserver = window.IntersectionObserver;

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const intro = (container: HTMLElement) => container.querySelector(".intro") as HTMLElement;
const state = (container: HTMLElement) => intro(container).getAttribute("data-ignite");
const glow = (container: HTMLElement) => container.querySelector(".candle-room-glow") as HTMLElement;

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => void window.dispatchEvent(new Event("scroll")));
}

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  local.clear();
  resetIntroPlayed();
  session = new Map();
  entry = { isIntersecting: true, intersectionRatio: 1 };
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => void local.set(key, value),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => void session.set(key, value),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});
afterEach(() => {
  vi.useRealTimers();
  window.IntersectionObserver = originalObserver;
  globalThis.IntersectionObserver = originalObserver;
});

describe("the page lights up", () => {
  it("starts when the logo is visible, then does not replay on an in-app return", () => {
    const first = renderHome();
    expect(state(first.container)).toBe("go");
    first.unmount();
    expect(state(renderHome().container)).toBe("lit"); // in-app return: finished at once
  });

  it("waits while the logo is off-screen, and never longer than the 1s fallback", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    const { container } = renderHome();
    expect(state(container)).toBe("idle");
    act(() => void vi.advanceTimersByTime(1100));
    expect(state(container)).toBe("lit");
  });

  it("reduced motion: lit at first render (no dark frame) and the motion is switched off", () => {
    reduced = true;
    const a = renderHome();
    expect(state(a.container)).toBe("lit");
    expect(intro(a.container)).toHaveAttribute("data-candle-motion", "paused");
  });
});

describe("gated content stays available while the room is dark", () => {
  it("everything is in the accessibility tree and layout from the first frame", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 }; // stay in idle: the darkest state
    const { container } = renderHome();
    expect(state(container)).toBe("idle");

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Candle" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Browse clinical trials" }).length).toBeGreaterThan(0);
    const gated = [...container.querySelectorAll(".reveal")];
    expect(gated.length).toBeGreaterThanOrEqual(5);
    for (const element of gated) {
      expect(element.closest("[hidden], [aria-hidden='true'], [inert]")).toBeNull();
      expect((element as HTMLElement).style.display).not.toBe("none");
      expect((element as HTMLElement).style.visibility).not.toBe("hidden");
    }
  });

  it("pressing Tab or a key reveals everything immediately", () => {
    const tab = renderHome();
    expect(state(tab.container)).toBe("go");
    act(() => void fireEvent.keyDown(document, { key: "Tab" }));
    expect(state(tab.container)).toBe("lit");
  });
});

describe("room glow", () => {
  it("follows scroll while running", () => {
    const { container } = renderHome();
    scrollTo(500); // 500 / (2000 - 1000)
    expect(glow(container).style.getPropertyValue("--glow")).toBe("0.5");
  });

  it("reduced motion: does not follow scroll", () => {
    reduced = true;
    const { container } = renderHome();
    scrollTo(800);
    expect(glow(container).style.getPropertyValue("--glow")).toBe("");
  });
});
