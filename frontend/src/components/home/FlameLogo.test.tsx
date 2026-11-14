import { act, fireEvent, render, screen } from "@testing-library/react";
import { Flame } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FLAME_PATH,
  FlameLogo,
  IGNITE_EDGES,
  IGNITE_STATES,
  PauseAnimationButton,
  ignitionNext,
  type IgniteState,
} from "./FlameLogo";
import { useCandleMotion } from "./useCandleMotion";

let reduced = false;
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced,
}));

// Node's experimental global localStorage shadows jsdom's here; use a plain stub.
const store = new Map<string, string>();

// IntersectionObserver double: reports `entry` as soon as an element is observed.
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

function Harness() {
  const motion = useCandleMotion();
  return (
    <>
      <FlameLogo running={motion.running} />
      <PauseAnimationButton
        paused={motion.paused}
        reduced={motion.reduced}
        onToggle={motion.togglePaused}
      />
    </>
  );
}

const logo = (container: HTMLElement) => container.querySelector(".flame-logo") as HTMLElement;
const glow = (container: HTMLElement) => container.querySelector(".candle-room-glow") as HTMLElement;
const ignite = (container: HTMLElement) => logo(container).getAttribute("data-ignite");

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => void window.dispatchEvent(new Event("scroll")));
}

// test/setup.ts defines IntersectionObserver as a plain writable property (not configurable), so it
// is replaced by assignment rather than vi.stubGlobal.
const originalObserver = window.IntersectionObserver;
afterEach(() => {
  window.IntersectionObserver = originalObserver;
  globalThis.IntersectionObserver = originalObserver;
});

beforeEach(() => {
  reduced = false;
  entry = { isIntersecting: true, intersectionRatio: 1 };
  store.clear();
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
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

describe("the logo is the original logo", () => {
  it("draws exactly the lucide Flame path, at the original 1.6 stroke, on all three layers", () => {
    const original = render(<Flame />).container.querySelector("path")!.getAttribute("d");
    expect(FLAME_PATH).toBe(original);

    const { container } = render(<FlameLogo running />);
    const paths = [...container.querySelectorAll("svg path")];
    expect(paths).toHaveLength(3); // ghost, trail, ember head
    for (const path of paths) {
      expect(path.getAttribute("d")).toBe(FLAME_PATH);
      expect(path.getAttribute("pathLength")).toBe("100");
    }
  });

  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<Harness />);
    expect(logo(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("focusable", "false");
  });
});

describe("ignition state machine", () => {
  const states = [...IGNITE_STATES];
  const allowed = (from: IgniteState, to: IgniteState) => IGNITE_EDGES[from].includes(to);

  it("defines exactly idle, go and lit, with lit terminal", () => {
    expect(states).toEqual(["idle", "go", "lit"]);
    expect(IGNITE_EDGES.lit).toEqual([]);
  });

  it.each(states.flatMap((from) => states.map((to) => [from, to] as const)))(
    "%s -> %s",
    (from, to) => {
      const expected = from === to || allowed(from, to) ? to : from;
      expect(ignitionNext(from, to)).toBe(expected);
    },
  );

  it("rejects the forbidden edges (the bugs live there): go->idle, lit->idle, lit->go", () => {
    expect(ignitionNext("go", "idle")).toBe("go");
    expect(ignitionNext("lit", "idle")).toBe("lit");
    expect(ignitionNext("lit", "go")).toBe("lit");
  });
});

describe("ignition lifecycle", () => {
  it("starts unlit and only begins once the logo is visible", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("idle"); // off-screen: nothing plays unseen
  });

  it("begins when at least half of the logo is visible", () => {
    entry = { isIntersecting: true, intersectionRatio: 0.3 };
    const partial = render(<Harness />);
    expect(ignite(partial.container)).toBe("idle");
    partial.unmount();

    entry = { isIntersecting: true, intersectionRatio: 0.6 };
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("go");
  });

  it("waits while the tab is hidden, then starts when it becomes visible", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("idle");

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(ignite(container)).toBe("go");
  });

  it("reduced motion: lit immediately (never a dark frame) and nothing to pause", () => {
    reduced = true;
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("lit");
    expect(logo(container)).toHaveAttribute("data-candle-motion", "paused");
    expect(screen.queryByRole("button", { name: "Pause animation" })).not.toBeInTheDocument();
  });

  it("a remembered pause starts lit (never a dark frame)", () => {
    store.set("candle-motion", "paused");
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("lit");
  });

  it("pausing mid-ignition settles to the finished logo, and lit is terminal", () => {
    const { container } = render(<Harness />);
    expect(ignite(container)).toBe("go");

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(ignite(container)).toBe("lit");

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" })); // resume
    expect(logo(container)).toHaveAttribute("data-candle-motion", "running");
    expect(ignite(container)).toBe("lit"); // it does not replay from dark
  });
});

describe("pause control and scroll glow", () => {
  it("one labelled button pauses everything and the choice is remembered", () => {
    const { container, unmount } = render(<Harness />);
    expect(logo(container)).toHaveAttribute("data-candle-motion", "running");

    // Fixed visible label + aria-pressed (the label never flips text).
    const button = screen.getByRole("button", { name: "Pause animation" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(logo(container)).toHaveAttribute("data-candle-motion", "paused");
    expect(screen.getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "true");
    expect(store.get("candle-motion")).toBe("paused");

    unmount();
    expect(logo(render(<Harness />).container)).toHaveAttribute("data-candle-motion", "paused");
  });

  it("scroll moves the room glow while running and freezes it once paused", () => {
    const { container } = render(<Harness />);
    scrollTo(500); // 500 / (2000 - 1000)
    expect(glow(container).style.getPropertyValue("--glow")).toBe("0.5");

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
    scrollTo(1000);
    expect(glow(container).style.getPropertyValue("--glow")).toBe("0.5");
  });

  it("prefers-reduced-motion: the glow does not follow scroll", () => {
    reduced = true;
    const { container } = render(<Harness />);
    scrollTo(800);
    expect(glow(container).style.getPropertyValue("--glow")).toBe("");
  });
});
