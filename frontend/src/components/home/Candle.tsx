/**
 * The landing page candle: decorative SVG with a lighting entrance and a slow flicker, plus a soft
 * room glow that follows scroll. Motion is governed by `useCandleMotion` (pause + reduced motion)
 * and styled in index.css (`.candle-*`), where the flash-safety limits are documented and tested.
 * Nothing here carries information: it is `aria-hidden` and the page reads the same without it.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Pause } from "lucide-react";

import { ToggleButton } from "../ui/ToggleButton";
import { useScrollGlow } from "./useCandleMotion";

export function CandleArt({ running }: { running: boolean }) {
  const haloId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  useScrollGlow(glowRef, running);

  // Stop spending frames while the candle is scrolled out of view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="candle"
      data-candle-motion={running ? "running" : "paused"}
      data-candle-offscreen={offscreen}
    >
      <div ref={glowRef} className="candle-room-glow" />
      {/* Fixed width/height + viewBox reserve the space, so the candle never shifts the layout. */}
      <svg
        className="candle-art h-auto w-32 sm:w-40"
        width="160"
        height="240"
        viewBox="0 0 160 240"
        focusable="false"
      >
        <defs>
          <radialGradient id={haloId}>
            <stop offset="0" className="candle-halo-stop" stopOpacity="0.55" />
            <stop offset="1" className="candle-halo-stop" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="candle-halo" cx="80" cy="92" r="72" fill={`url(#${haloId})`} />
        <g className="candle-rise">
          <g className="candle-flicker-outer">
            <path
              className="candle-flame-outer"
              d="M80 36 C98 60 104 82 80 106 C56 82 62 60 80 36 Z"
            />
          </g>
          <g className="candle-flicker-mid">
            <path
              className="candle-flame-mid"
              d="M80 54 C92 72 94 88 80 104 C66 88 68 72 80 54 Z"
            />
            <path
              className="candle-flame-core"
              d="M80 76 C86 86 86 96 80 104 C74 96 74 86 80 76 Z"
            />
          </g>
        </g>
        <path className="candle-wick" d="M80 122 V104" fill="none" />
        <path className="candle-wax" d="M50 122 H110 V214 H50 Z" />
        <path className="candle-wax" d="M62 122 V148 C62 156 74 156 74 148 V122" />
        <rect className="candle-wax" x="36" y="214" width="88" height="8" />
      </svg>
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
