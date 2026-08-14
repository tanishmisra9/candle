import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { routeTransitionMotion } from "../lib/motion";

export function PageTransition({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const variants = routeTransitionMotion(prefersReducedMotion);

  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
    >
      {children}
    </motion.div>
  );
}
