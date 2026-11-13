/** Floating back-to-top button after 600px of scroll. Used by the list views (not Ask, which has its own composer and Jump-to-latest control). */
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";

import { Tooltip } from "./ui/Tooltip";

const SCROLL_THRESHOLD = 600;

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let ticking = false;

    const update = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-4 z-50 sm:right-6">
      <Tooltip label="Scroll to top" describe={false}>
        <button
          type="button"
          aria-label="Scroll to top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: prefersReducedMotion ? "auto" : "smooth",
            })
          }
          className="inline-flex h-11 w-11 items-center justify-center rounded-panel border border-line-strong bg-accent-fill text-accent-on transition-colors hover:bg-accent-fill-hover active:bg-accent-fill-pressed"
        >
          <ArrowUp size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
