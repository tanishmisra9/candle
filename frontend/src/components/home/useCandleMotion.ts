import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

// The same three conditions index.html's pre-paint script checks before it starts the dusk veil. Keep
// them in sync: if the script skipped the veil but React still started the intro, the page content
// would be hidden (transparent) for ~2s with no veil.
const CALM_QUERIES = ["(forced-colors: active)", "(prefers-contrast: more)"];
const prefersCalm = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && CALM_QUERIES.some((q) => window.matchMedia(q).matches);

/**
 * `running` is false under `prefers-reduced-motion`, forced colours or `prefers-contrast: more`: no
 * intro, the flicker stills and the scroll glow freezes.
 */
export function useCandleMotion() {
  const reducedMotion = Boolean(useReducedMotion());
  const [calm] = useState(prefersCalm);
  const reduced = reducedMotion || calm;
  return { running: !reduced, reduced };
}

/** Maps scroll progress (0..1) onto the room glow's `--glow` variable, one rAF per frame. */
export function useScrollGlow(glowRef: RefObject<HTMLElement | null>, running: boolean) {
  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || !running) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      glow.style.setProperty("--glow", String(Math.min(1, Math.max(0, progress))));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [glowRef, running]);
}
