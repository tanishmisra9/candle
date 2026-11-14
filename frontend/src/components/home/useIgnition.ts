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

/**
 * @param running false when the user paused or prefers reduced motion: start (and stay) lit.
 * Attach `observedRef` to the element whose visibility starts the sequence (the logo).
 */
export function useIgnition(running: boolean) {
  const observedRef = useRef<HTMLDivElement>(null);
  // Paused / reduced-motion visitors start lit: they never see a dark frame.
  const [ignite, setIgnite] = useState<IgniteState>(running ? "idle" : "lit");
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

  return { ignite, offscreen, observedRef };
}
