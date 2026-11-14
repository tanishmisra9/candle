/**
 * The landing-page logo: Candle's original flame (the exact lucide `Flame` path) as the huge
 * centerpiece of the hero. Lit, it is a filled flame (base-to-tip gradient) with an inner core
 * inside the original outline, casting a soft pool of light on the stage. The ignition
 * itself (dark -> spark -> ember travels the outline -> the flame catches) is pure CSS driven by
 * the `data-ignite` state that `useIgnition` puts on the page wrapper (see index.css `.flame-*`,
 * where the flash-safety limits are documented and tested). Decorative: `aria-hidden`.
 */
import { useId, type Ref } from "react";
import { Pause } from "lucide-react";

import { ToggleButton } from "../ui/ToggleButton";

// Identical to lucide-react's Flame path; FlameLogo.test.tsx fails if they ever differ.
export const FLAME_PATH =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

// The inner core is the same flame, scaled about its base (x=12, y=22) so it sits inside the outline.
const CORE_TRANSFORM = "translate(12 22) scale(0.5) translate(-12 -22)";

export function FlameLogo({ logoRef }: { logoRef: Ref<HTMLDivElement> }) {
  const gradientId = useId();

  return (
    <div ref={logoRef} aria-hidden="true" className="flame-logo">
      <div className="stage-light" />
      {/* Vector at 24x24 scaled to the hero size: crisp at any pixel density. */}
      <svg className="flame-svg" viewBox="0 0 24 24" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" className="flame-stop-base" />
            <stop offset="0.55" className="flame-stop-mid" />
            <stop offset="1" className="flame-stop-tip" />
          </linearGradient>
        </defs>
        <g className="flame-flicker">
          <path className="flame-fill" d={FLAME_PATH} fill={`url(#${gradientId})`} />
          <path className="flame-core" d={FLAME_PATH} transform={CORE_TRANSFORM} />
        </g>
        <path className="flame-ghost" d={FLAME_PATH} pathLength={100} />
        <path className="flame-trail" d={FLAME_PATH} pathLength={100} />
        <path className="flame-head" d={FLAME_PATH} pathLength={100} />
      </svg>
    </div>
  );
}

/**
 * Fixed visible label + `aria-pressed` (a label that also flips text would be announced twice and
 * contradict itself). Hidden when the OS already asks for reduced motion: nothing to pause.
 * Pressing it during the intro settles straight to the finished page.
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
    // bg-canvas: on the stage this is its own opaque surface, so the label stays legible even
    // while the light-theme veil is still cream.
    <ToggleButton pressed={paused} onClick={onToggle} className="bg-canvas !text-[1rem]">
      <Pause size={14} strokeWidth={1.75} aria-hidden="true" />
      Pause animation
    </ToggleButton>
  );
}
