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
import { useRef } from "react";
import { Pause } from "lucide-react";

import { ToggleButton } from "../ui/ToggleButton";
import { useIgnition } from "./useIgnition";
import { useScrollGlow } from "./useCandleMotion";

// Identical to lucide-react's Flame path; FlameLogo.test.tsx fails if they ever differ.
export const FLAME_PATH =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

export function FlameLogo({ running }: { running: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const { ignite, offscreen, observedRef: rootRef } = useIgnition(running);

  useScrollGlow(glowRef, running);

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
