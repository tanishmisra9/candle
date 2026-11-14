/**
 * The landing-page ignition: when the logo lights and the page behind it reveals. Owns the state
 * machine (`idle -> go -> lit`, `lit` terminal) and the rules for when it may start, so the
 * logo and the page both react to one source of truth (applied as `data-ignite` in the view).
 */
import { useEffect, useRef, useState } from "react";

// The ignition's states and the only allowed transitions between them. `lit` is terminal: a
// finished (or paused/reduced-motion) page never goes back to dark and never replays. Every write
// to the state goes through `ignitionNext`.
export const IGNITE_STATES = ["idle", "go", "lit"] as const;
export type IgniteState = (typeof IGNITE_STATES)[number];
export const IGNITE_EDGES: Record<IgniteState, readonly IgniteState[]> = {
  idle: ["go", "lit"], // idle -> go: visible and running; idle -> lit: paused/reduced before starting
  go: ["lit"], // go -> lit: paused mid-sequence settles to the finished page
  lit: [],
};

/** The state after requesting `to`: `to` if the edge is allowed (or a no-op), otherwise unchanged. */
export function ignitionNext(from: IgniteState, to: IgniteState): IgniteState {
  return from === to || IGNITE_EDGES[from].includes(to) ? to : from;
}

const START_VISIBLE_RATIO = 0.5; // begin once at least half of the observed element is on screen
const NO_OBSERVER_START_MS = 600; // browsers without IntersectionObserver start shortly after load
// If the intro has not started this long after mount (tab visible), show the finished page. This
// bounds how long content can stay transparent under ANY viewport: at 400% zoom the logo may
// never be half visible, and low-vision visitors must not be left with a blank page.
const FALLBACK_TO_LIT_MS = 1500;
const SEEN_KEY = "candle-intro-seen"; // sessionStorage: play once per browser session

// Input that means "I am here, show me the page". Route-change focus (PageTransition focusing the
// new <h1>, or <main>) is not user input and must not skip the intro.
const SKIP_EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
const isRouteFocus = (target: EventTarget | null) =>
  target instanceof Element && (target.matches("[data-route-heading]") || target.id === "main-content");

function readSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false; // storage can be blocked; the intro simply plays
  }
}
function writeSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // not remembered; harmless
  }
}

/**
 * @param running false when the user paused or prefers reduced motion: start (and stay) lit.
 * Attach `observedRef` to the element whose visibility starts the sequence (the logo).
 */
export function useIgnition(running: boolean) {
  const observedRef = useRef<HTMLDivElement>(null);
  // Paused, reduced-motion and already-seen visitors start lit: they never see a dark frame. Read in
  // the initializer so the very first render carries the right state (no flash of hidden content).
  const [ignite, setIgnite] = useState<IgniteState>(() => (running && !readSeen() ? "idle" : "lit"));
  const [offscreen, setOffscreen] = useState(false);
  const [visibleEnough, setVisibleEnough] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  // Pausing (or reduced motion) settles to the finished state.
  useEffect(() => {
    if (!running) setIgnite((state) => ignitionNext(state, "lit"));
  }, [running]);

  // Never play unseen: wait until the element is actually on screen.
  useEffect(() => {
    const element = observedRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisibleEnough(true), NO_OBSERVER_START_MS);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOffscreen(!entry.isIntersecting);
        if (entry.intersectionRatio >= START_VISIBLE_RATIO) setVisibleEnough(true);
      },
      { threshold: [0, START_VISIBLE_RATIO] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ...nor in a background tab.
  useEffect(() => {
    const onChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (running && visibleEnough && tabVisible) setIgnite((state) => ignitionNext(state, "go"));
  }, [running, visibleEnough, tabVisible]);

  // Played (or started) once: remember for the rest of the session.
  useEffect(() => {
    if (ignite === "go") writeSeen();
  }, [ignite]);

  // Never leave content hidden for long if the intro cannot start.
  useEffect(() => {
    if (ignite !== "idle" || !tabVisible) return;
    const timer = window.setTimeout(() => setIgnite((state) => ignitionNext(state, "lit")), FALLBACK_TO_LIT_MS);
    return () => window.clearTimeout(timer);
  }, [ignite, tabVisible]);

  // Any real input skips to the finished page (so the first Tab press lands on a visible control).
  useEffect(() => {
    if (ignite === "lit") return;
    const skip = () => setIgnite((state) => ignitionNext(state, "lit"));
    const onFocusIn = (event: FocusEvent) => {
      if (!isRouteFocus(event.target)) skip();
    };
    for (const type of SKIP_EVENTS) document.addEventListener(type, skip, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      for (const type of SKIP_EVENTS) document.removeEventListener(type, skip);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [ignite]);

  return { ignite, offscreen, observedRef };
}
