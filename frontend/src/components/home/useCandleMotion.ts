import { useEffect, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

/** `running` is false under `prefers-reduced-motion`: the flicker stills and the scroll glow freezes. */
export function useCandleMotion() {
  const reduced = Boolean(useReducedMotion());
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
