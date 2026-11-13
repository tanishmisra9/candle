import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandleArt, PauseAnimationButton } from "./Candle";
import { useCandleMotion } from "./useCandleMotion";

let reduced = false;
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced,
}));

// Node's experimental global localStorage shadows jsdom's here; use a plain stub.
const store = new Map<string, string>();

function Harness() {
  const motion = useCandleMotion();
  return (
    <>
      <CandleArt running={motion.running} />
      <PauseAnimationButton
        paused={motion.paused}
        reduced={motion.reduced}
        onToggle={motion.togglePaused}
      />
    </>
  );
}

const candle = (container: HTMLElement) => container.querySelector(".candle") as HTMLElement;
const glow = (container: HTMLElement) => container.querySelector(".candle-room-glow") as HTMLElement;

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => void window.dispatchEvent(new Event("scroll")));
}

beforeEach(() => {
  reduced = false;
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("candle motion", () => {
  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<Harness />);
    expect(candle(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("focusable", "false");
  });

  it("pauses everything with one labelled button, and remembers the choice", () => {
    const { container, unmount } = render(<Harness />);
    expect(candle(container)).toHaveAttribute("data-candle-motion", "running");

    // Fixed visible label + aria-pressed (the label never flips text).
    const button = screen.getByRole("button", { name: "Pause animation" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);
    expect(candle(container)).toHaveAttribute("data-candle-motion", "paused");
    expect(screen.getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "true");
    expect(store.get("candle-motion")).toBe("paused");

    // A new visit starts paused.
    unmount();
    const next = render(<Harness />);
    expect(candle(next.container)).toHaveAttribute("data-candle-motion", "paused");
  });

  it("scroll moves the room glow while running and freezes it once paused", () => {
    const { container } = render(<Harness />);
    scrollTo(500); // 500 / (2000 - 1000)
    expect(glow(container).style.getPropertyValue("--glow")).toBe("0.5");

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
    scrollTo(1000);
    expect(glow(container).style.getPropertyValue("--glow")).toBe("0.5");
  });

  it("prefers-reduced-motion: no motion and nothing left to pause", () => {
    reduced = true;
    const { container } = render(<Harness />);
    expect(candle(container)).toHaveAttribute("data-candle-motion", "paused");
    expect(screen.queryByRole("button", { name: "Pause animation" })).not.toBeInTheDocument();

    scrollTo(800);
    expect(glow(container).style.getPropertyValue("--glow")).toBe("");
  });
});
