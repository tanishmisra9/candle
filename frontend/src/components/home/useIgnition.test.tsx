import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIgnition, resetIntroPlayed } from "./useIgnition";

// Node's experimental global storage shadows jsdom's here; use plain stubs.
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

function Harness({ running = true }: { running?: boolean }) {
  const { ignite, observedRef } = useIgnition(running);
  return (
    <main id="main-content" tabIndex={-1}>
      <div ref={observedRef} data-testid="logo" data-ignite={ignite} />
      <h1 data-route-heading tabIndex={-1}>
        Title
      </h1>
      <button type="button">Action</button>
    </main>
  );
}
const state = () => screen.getByTestId("logo").getAttribute("data-ignite");

beforeEach(() => {
  vi.useFakeTimers();
  resetIntroPlayed();
  session = new Map();
  entry = { isIntersecting: true, intersectionRatio: 1 };
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => void session.set(key, value),
  });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
afterEach(() => {
  vi.useRealTimers();
  window.IntersectionObserver = originalObserver;
  globalThis.IntersectionObserver = originalObserver;
});

describe("replays on every page load", () => {
  it("plays on a fresh load", () => {
    render(<Harness />);
    expect(state()).toBe("go");
  });

  it("an in-app return after it started starts lit (no dark frame, no replay); a reload replays", () => {
    const first = render(<Harness />);
    expect(state()).toBe("go");
    first.unmount();
    render(<Harness />);
    expect(state()).toBe("lit");
    cleanup();
    resetIntroPlayed(); // what a full page load does
    render(<Harness />);
    expect(state()).toBe("go");
  });

  it("an intro that ended by falling back to lit (idle -> lit) is not replayed on a return either", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    const first = render(<Harness />);
    act(() => void vi.advanceTimersByTime(1100));
    expect(state()).toBe("lit");
    first.unmount();
    entry = { isIntersecting: true, intersectionRatio: 1 };
    render(<Harness />);
    expect(state()).toBe("lit"); // not "idle" -> go: no second dim-and-reveal
  });

  it("never touches storage (a blocked-storage browser plays the same way)", () => {
    const touched = vi.fn();
    vi.stubGlobal("sessionStorage", { getItem: touched, setItem: touched });
    render(<Harness />);
    expect(state()).toBe("go");
    expect(touched).not.toHaveBeenCalled();
  });
});

describe("content is never hidden for long", () => {
  it("falls back to lit after 1s if the intro never starts (e.g. 400% zoom: nothing half-visible)", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    render(<Harness />);
    expect(state()).toBe("idle");
    act(() => void vi.advanceTimersByTime(900));
    expect(state()).toBe("idle");
    act(() => void vi.advanceTimersByTime(200));
    expect(state()).toBe("lit");
  });

  it("does not run the fallback clock while the tab is in the background", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(state()).toBe("idle"); // nobody is looking, nothing to reveal yet
  });

  it("the fallback does not cut a running intro short; the intro settles to lit when it ends", () => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(2200));
    expect(state()).toBe("go");
    act(() => void vi.advanceTimersByTime(200));
    expect(state()).toBe("lit");
  });
});

describe("any user input skips to the finished page", () => {
  it.each([
    ["a key press", () => fireEvent.keyDown(document, { key: "Tab" })],
    ["a pointer press", () => fireEvent.pointerDown(document.body)],
    ["the wheel", () => fireEvent.wheel(document.body)],
    ["a touch", () => fireEvent.touchStart(document.body)],
    ["focus moving to a real control", () => fireEvent.focusIn(screen.getByRole("button", { name: "Action" }))],
  ])("%s", (_name, act1) => {
    render(<Harness />);
    expect(state()).toBe("go");
    act(() => void act1());
    expect(state()).toBe("lit");
  });

  it("skips even before the intro has started (idle)", () => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    render(<Harness />);
    expect(state()).toBe("idle");
    act(() => void fireEvent.keyDown(document, { key: "Tab" }));
    expect(state()).toBe("lit");
  });

  it("the route-change focus on the new heading or <main> is NOT a user skip", () => {
    render(<Harness />);
    act(() => void fireEvent.focusIn(screen.getByRole("heading", { name: "Title" })));
    act(() => void fireEvent.focusIn(document.getElementById("main-content")!));
    expect(state()).toBe("go");
  });

  it("lit is terminal: later input and a resumed 'running' do not change it", () => {
    const { rerender } = render(<Harness />);
    act(() => void fireEvent.keyDown(document, { key: "a" }));
    expect(state()).toBe("lit");
    rerender(<Harness running={false} />);
    rerender(<Harness running />);
    expect(state()).toBe("lit");
  });
});
