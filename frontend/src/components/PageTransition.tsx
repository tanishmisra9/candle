/** Route enter/exit animation wrapper that also moves focus to the new page heading after client-side navigation. */
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import { routeTransitionMotion } from "../lib/motion";

// False until the first route has settled, so the initial page load never steals focus.
let hasNavigated = false;

// cascade: the page's top-level blocks fade in top to bottom (opacity only). Home has its own intro,
// and Ask has a fixed composer that owns its own entrance, so those two opt out. className lets a
// page take part in the app shell's flex column (Home fills the screen that way).
export function PageTransition({
  children,
  cascade = true,
  className,
}: {
  children: ReactNode;
  cascade?: boolean;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const variants = routeTransitionMotion(prefersReducedMotion);
  const ref = useRef<HTMLDivElement>(null);

  // After a client-side route change, move focus to the page heading so keyboard and screen
  // reader users land at the top of the new content (WCAG 2.4.3). The flag flips on a timer so
  // StrictMode's double-invoked effect doesn't count the first mount as a navigation.
  useEffect(() => {
    if (hasNavigated) {
      // A page can name the one control that should receive focus on arrival (the Ask question box:
      // `data-route-autofocus`) so the visitor can type straight away. Only with a mouse-like pointer:
      // on touch devices it would pop the on-screen keyboard over the page.
      const autofocus =
        window.matchMedia?.("(hover: hover) and (pointer: fine)").matches
          ? ref.current?.querySelector<HTMLElement>("[data-route-autofocus]")
          : null;
      if (autofocus) {
        autofocus.focus({ preventScroll: true });
        return;
      }
      // Fall back to <main> if the heading is not rendered yet, so focus is never left on the
      // previous page's removed link (which would drop keyboard users at the top of <body>).
      const target =
        ref.current?.querySelector<HTMLElement>("h1") ?? document.getElementById("main-content");
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.setAttribute("data-route-heading", "");
        target.focus({ preventScroll: true });
      }
    }
    const timer = window.setTimeout(() => {
      hasNavigated = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      ref={ref}
      className={clsx(cascade && "page-cascade", className) || undefined}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
    >
      {children}
    </motion.div>
  );
}
