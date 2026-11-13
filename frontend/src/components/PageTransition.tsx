/** Route enter/exit animation wrapper that also moves focus to the new page heading after client-side navigation. */
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import { routeTransitionMotion } from "../lib/motion";

// False until the first route has settled, so the initial page load never steals focus.
let hasNavigated = false;

export function PageTransition({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const variants = routeTransitionMotion(prefersReducedMotion);
  const ref = useRef<HTMLDivElement>(null);

  // After a client-side route change, move focus to the page heading so keyboard and screen
  // reader users land at the top of the new content (WCAG 2.4.3). The flag flips on a timer so
  // StrictMode's double-invoked effect doesn't count the first mount as a navigation.
  useEffect(() => {
    const heading = ref.current?.querySelector<HTMLElement>("h1");
    if (hasNavigated && heading) {
      heading.setAttribute("tabindex", "-1");
      heading.setAttribute("data-route-heading", "");
      heading.focus({ preventScroll: true });
    }
    const timer = window.setTimeout(() => {
      hasNavigated = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
    >
      {children}
    </motion.div>
  );
}
