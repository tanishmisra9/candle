/**
 * The landing-page logo: Candle's original flame (the exact lucide `Flame` path) as the huge
 * centerpiece of the hero. Lit, it is a layered flame (a soft blurred glow copy, a four-colour body
 * gradient, an inner core) inside the original outline, casting a soft pool of light on the stage.
 * The ignition (spark at the wick -> the outline draws -> the flame grows up from the wick -> the
 * room lifts) is pure CSS driven by the `data-ignite` state that `useIgnition` puts on the page
 * wrapper (see index.css `.flame-*`, where the flash-safety limits are documented and tested).
 * Decorative: `aria-hidden`.
 */
import { useId, type Ref } from "react";

// Identical to lucide-react's Flame path; FlameLogo.test.tsx fails if they ever differ.
export const FLAME_PATH =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

// The inner core is the same flame, scaled about its base (x=12, y=22) so it sits inside the outline.
const CORE_TRANSFORM = "translate(12 22) scale(0.5) translate(-12 -22)";

export function FlameLogo({ logoRef }: { logoRef: Ref<HTMLDivElement> }) {
  const id = useId();
  const gradientId = `${id}-body`;
  const blurId = `${id}-blur`;

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
          <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.55" />
          </filter>
        </defs>
        {/* One group zooms in, and inside it one group flickers: the body, the inner flame AND the outline
            always move together, so the inner flame can never drift against (or behind) the outline. */}
        <g className="flame-zoom">
          <g className="flame-flicker">
            <g className="flame-body">
              <path className="flame-halo" d={FLAME_PATH} fill={`url(#${gradientId})`} filter={`url(#${blurId})`} />
              <path className="flame-fill" d={FLAME_PATH} fill={`url(#${gradientId})`} />
              {/* The wrapper carries the inner flame's own slow sway; the path keeps the static
                  scale-into-the-outline transform as an attribute (a CSS transform would override it). */}
              <g className="flame-core-live">
                <path className="flame-core" d={FLAME_PATH} transform={CORE_TRANSFORM} />
              </g>
            </g>
            <path className="flame-outline" d={FLAME_PATH} />
          </g>
        </g>
        <path className="flame-ghost" d={FLAME_PATH} />
      </svg>
    </div>
  );
}
