/**
 * The landing-page logo: Candle's original flame (the lucide `Flame` outline in its soft round
 * tile) igniting once: it starts as a dim but visible outline, an ember lights at the inner curl,
 * travels the stroke leaving amber behind it, then the tile and glow warm. Decorative: it is
 * `aria-hidden` and the page reads the same without it.
 *
 * Motion lives in index.css (`.flame-*`, where the flash-safety limits are documented and tested)
 * and is governed by `useCandleMotion` (pause + reduced motion). The base CSS is the finished lit
 * logo, so every "no animation" path (paused, reduced motion, forced colours, no JS) is lit.
 */
import { useEffect, useRef, useState } from "react";
import { Pause } from "lucide-react";

import { ToggleButton } from "../ui/ToggleButton";
import { useScrollGlow } from "./useCandleMotion";

// Identical to lucide-react's Flame path; FlameLogo.test.tsx fails if they ever differ.
export const FLAME_PATH =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

// The ignition's states and the only allowed transitions between them. `lit` is terminal: a
// finished (or paused/reduced-motion) logo never goes back to dark and never replays. Every write
// to the state goes through `ignitionNext`.
export const IGNITE_STATES = ["idle", "go", "lit"] as const;
export type IgniteState = (typeof IGNITE_STATES)[number];
export const IGNITE_EDGES: Record<IgniteState, readonly IgniteState[]> = {
  idle: ["go", "lit"], // idle -> go: visible and running; idle -> lit: paused/reduced before starting
  go: ["lit"], // go -> lit: paused mid-sequence settles to the finished logo
  lit: [],
};

/** The state after requesting `to`: `to` if the edge is allowed (or a no-op), otherwise unchanged. */
export function ignitionNext(from: IgniteState, to: IgniteState): IgniteState {
  return from === to || IGNITE_EDGES[from].includes(to) ? to : from;
}

const START_VISIBLE_RATIO = 0.5; // begin once at least half of the logo is on screen
const NO_OBSERVER_START_MS = 600; // browsers without IntersectionObserver start shortly after load

export function FlameLogo({ running }: { running: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  // Paused / reduced-motion visitors start lit: they never see a dark frame.
  const [ignite, setIgnite] = useState<IgniteState>(running ? "idle" : "lit");
  const [offscreen, setOffscreen] = useState(false);
  const [visibleEnough, setVisibleEnough] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useScrollGlow(glowRef, running);

  // Pausing (or reduced motion) settles to the finished logo.
  useEffect(() => {
    if (!running) setIgnite((state) => ignitionNext(state, "lit"));
  }, [running]);

  // Never play unseen: wait until the logo is actually on screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
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
    observer.observe(root);
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

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="candle flame-logo"
      data-candle-motion={running ? "running" : "paused"}
      data-candle-offscreen={offscreen}
      data-ignite={ignite}
    >
      <div ref={glowRef} className="candle-room-glow" />
      {/* The original logo tile: soft round, faint amber fill and glow (the one round shape in the
          app). Fixed size, so the logo never shifts the layout. */}
      <div className="relative flex h-16 w-16 items-center justify-center md:h-20 md:w-20">
        <span className="flame-glow absolute inset-0 rounded-full" />
        <span className="flame-tile absolute inset-0 rounded-full bg-accent/10" />
        <svg
          className="relative h-8 w-8 md:h-10 md:w-10"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path className="flame-ghost" d={FLAME_PATH} pathLength={100} />
          <path className="flame-trail" d={FLAME_PATH} pathLength={100} />
          <path className="flame-head" d={FLAME_PATH} pathLength={100} />
        </svg>
      </div>
    </div>
  );
}

/**
 * Fixed visible label + `aria-pressed` (a label that also flips text would be announced twice and
 * contradict itself). Hidden when the OS already asks for reduced motion: nothing to pause.
 */
export function PauseAnimationButton({
  paused,
  reduced,
  onToggle,
}: {
  paused: boolean;
  reduced: boolean;
  onToggle: () => void;
}) {
  if (reduced) return null;
  return (
    <ToggleButton pressed={paused} onClick={onToggle} className="!text-[1rem]">
      <Pause size={14} strokeWidth={1.75} aria-hidden="true" />
      Pause animation
    </ToggleButton>
  );
}
