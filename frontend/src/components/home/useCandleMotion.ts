import { useCallback, useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

const STORAGE_KEY = "candle-motion";

function readPaused() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "paused";
  } catch {
    return false; // storage can be blocked; default to the animated candle
  }
}

/**
 * One switch for all landing-page motion (WCAG 2.2.2): the user's "Pause animation" choice
 * (remembered) and `prefers-reduced-motion` both turn `running` off, which stills the flicker AND
 * freezes the scroll glow.
 */
export function useCandleMotion() {
  const reduced = Boolean(useReducedMotion());
  const [paused, setPaused] = useState(readPaused);

  const togglePaused = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "paused" : "running");
      } catch {
        // not persisted; still applies for this visit
      }
      return next;
    });
  }, []);

  return { running: !reduced && !paused, paused, reduced, togglePaused };
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
