import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIgnition, resetIntroPlayed } from "./useIgnition";

// Node's experimental global storage shadows jsdom's here; use plain stubs.
let session = new Map<string, string>();

let entry = { isIntersecting: true, intersectionRatio: 1 };
let reportIntersection: ((next: { isIntersecting: boolean; intersectionRatio: number }) => void) | null = null;
class FakeIntersectionObserver {
  constructor(private callback: (entries: unknown[]) => void) {}
  observe() {
    this.callback([entry]);
    reportIntersection = (next) => this.callback([next]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const originalObserver = window.IntersectionObserver;

function Harness({ running = true }: { running?: boolean }) {
  const { ignite, offscreen, observedRef } = useIgnition(running);
  return (
    <main id="main-content" tabIndex={-1}>
      <div ref={observedRef} data-testid="logo" data-ignite={ignite} data-offscreen={String(offscreen)} />
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

describe("scrolling, touching or clicking during the intro hurries it instead of snapping to the end", () => {
  // jsdom has no Web Animations; give document a few fake animations to count on. `iterations` is what
  // tells the flame's infinite flicker (never hurried) from the intro's animations that end.
  const fake = (animationName: string | undefined, iterations = 1) => ({
    animationName,
    effect: { getComputedTiming: () => ({ iterations }) },
    updatePlaybackRate: vi.fn(),
  });
  let animations: ReturnType<typeof fake>[];
  beforeEach(() => {
    animations = [
      fake("flame-appear"),
      fake("flame-veil-out"),
      fake("flame-ignite"),
      fake("flame-glow"), // a NEW intro animation nobody listed anywhere: it must be hurried too
      fake("flame-flicker", Infinity), // the loop keeps its own pace
      fake(undefined), // a Web Animations API animation (not CSS), e.g. framer-motion's
    ];
    Object.defineProperty(document, "getAnimations", { configurable: true, value: () => animations });
  });
  afterEach(() => void delete (document as unknown as { getAnimations?: unknown }).getAnimations);

  const hurried = () => animations.filter((a) => a.updatePlaybackRate.mock.calls.length > 0).map((a) => a.animationName);

  it.each([
    ["the wheel", () => fireEvent.wheel(document.body)],
    ["a touch", () => fireEvent.touchStart(document.body)],
    ["a pointer press", () => fireEvent.pointerDown(document.body)],
  ])("%s keeps the intro running and speeds up only the CSS animations that end", (_name, input) => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(500));
    act(() => void input());
    expect(state()).toBe("go"); // NOT lit: nothing snaps to opaque (the DOM sees `go`; internally it is `hurried`)
    expect(hurried()).toEqual(["flame-appear", "flame-veil-out", "flame-ignite", "flame-glow"]);
    for (const a of animations.filter((x) => hurried().includes(x.animationName))) {
      expect(a.updatePlaybackRate).toHaveBeenCalledWith(5);
    }
  });

  it("settles to lit after the REMAINING time at the faster rate, far sooner than the normal 2.3s", () => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(500)); // 1.8s of the 2.3s intro left
    act(() => void fireEvent.wheel(document.body));
    act(() => void vi.advanceTimersByTime(300)); // 1800 / 5 = 360ms (+ margin) is not over yet
    expect(state()).toBe("go");
    act(() => void vi.advanceTimersByTime(200)); // 500ms after the wheel: done (it would be 1.8s without hurrying)
    expect(state()).toBe("lit");
  });

  it("a stream of wheel events hurries once, not once per event", () => {
    render(<Harness />);
    act(() => void fireEvent.wheel(document.body));
    act(() => void fireEvent.wheel(document.body));
    act(() => void fireEvent.wheel(document.body));
    expect(animations[0].updatePlaybackRate).toHaveBeenCalledTimes(1);
  });

  it("a hurried intro is NOT paused when the logo leaves the screen (the pause froze it, then it snapped)", () => {
    render(<Harness />);
    const logo = () => screen.getByTestId("logo");
    act(() => void reportIntersection!({ isIntersecting: false, intersectionRatio: 0 })); // scrolled past the logo
    expect(logo()).toHaveAttribute("data-offscreen", "true"); // a normal intro pauses here (index.css)
    act(() => void fireEvent.wheel(document.body)); // ...and the wheel that scrolled it also hurries it
    expect(logo()).toHaveAttribute("data-offscreen", "false"); // so the CSS must let it run
    act(() => void vi.advanceTimersByTime(700));
    expect(state()).toBe("lit");
  });

  it("with nothing left to speed up it settles at once instead of waiting for a timer", () => {
    animations.length = 0;
    render(<Harness />);
    act(() => void fireEvent.wheel(document.body));
    expect(state()).toBe("lit");
  });

  it.each([
    ["the wheel", () => fireEvent.wheel(document.body)],
    ["a touch", () => fireEvent.touchStart(document.body)],
    ["a pointer press", () => fireEvent.pointerDown(document.body)],
  ])("before the intro has started %s settles at once (nothing is revealed yet, so nothing to hurry)", (_name, input) => {
    entry = { isIntersecting: false, intersectionRatio: 0 };
    render(<Harness />);
    expect(state()).toBe("idle");
    act(() => void input());
    expect(state()).toBe("lit"); // content must not stay transparent until the 1s fallback despite the input
    expect(hurried()).toEqual([]);
  });

  it("pressing a control hurries; the focus that press causes is not a Tab and does not skip it", () => {
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Action" });
    act(() => void fireEvent.pointerDown(button));
    act(() => void fireEvent.focusIn(button)); // the same press moving focus onto the control
    expect(state()).toBe("go");
    expect(hurried().length).toBeGreaterThan(0);
  });

  it("a real Tab (focus with no press just before it) still settles at once, even mid-hurry", () => {
    render(<Harness />);
    act(() => void fireEvent.wheel(document.body));
    act(() => void vi.advanceTimersByTime(300)); // long after any press
    act(() => void fireEvent.focusIn(screen.getByRole("button", { name: "Action" })));
    expect(state()).toBe("lit");
  });

  it("a key press still settles to the finished page at once (Tab must land on a visible control)", () => {
    render(<Harness />);
    act(() => void fireEvent.keyDown(document, { key: "Tab" }));
    expect(state()).toBe("lit");
    expect(hurried()).toEqual([]);
  });

  it("falls back to the instant skip where the Web Animations API does not exist", () => {
    delete (document as unknown as { getAnimations?: unknown }).getAnimations;
    render(<Harness />);
    act(() => void fireEvent.wheel(document.body));
    expect(state()).toBe("lit");
  });
});

describe("keys and focus skip to the finished page (scroll, touch and click hurry it: see above)", () => {
  it.each([
    ["a key press", () => fireEvent.keyDown(document, { key: "Tab" })],
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
