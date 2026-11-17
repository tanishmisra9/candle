/** Shared framer-motion variants. Every factory takes `prefersReducedMotion` and returns a static/no-op variant when true. Add new shared motion here instead of inlining it in a component. Keep message entrance opacity-only (a y offset shifts layout while Ask follows the stream). */
export function overlayBackdropMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
    };
  }

  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
}

export function overlayPanelMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.28 } },
    exit: { opacity: 0, y: 20 },
  };
}

// Opacity only, on purpose: a transform on the page wrapper becomes the containing block for
// `position: fixed` descendants (the Ask composer, the scroll-to-top button), which then render
// against the wrapper and jump to the viewport when the transform clears. See motion.test.ts.
export function routeTransitionMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
    };
  }

  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  };
}

export function listContentSwapMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
    };
  }

  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.18 } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  };
}

export function dropdownMenuMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.14 } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.09 } },
  };
}

/**
 * The full-screen mobile menu (ported from Telogify and the portfolio): the overlay fades in, then the links
 * rise one after another with a spring. Under reduced motion nothing moves or fades: it simply appears.
 * The overlay is a sibling of the fixed header, not an ancestor of anything `position: fixed`, so the item
 * `y` offset cannot shift fixed content (see PageTransition for the rule).
 */
export function mobileMenuMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    const still = { opacity: 1, y: 0 };
    return {
      overlay: { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } },
      list: { hidden: {}, show: {}, exit: {} },
      item: { hidden: still, show: still, exit: still },
    };
  }

  const spring = { type: "spring" as const, stiffness: 250, damping: 25 };
  return {
    overlay: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.25 } },
      exit: { opacity: 0, transition: { duration: 0.2 } },
    },
    list: { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } }, exit: {} },
    item: {
      hidden: { opacity: 0, y: 32 },
      show: { opacity: 1, y: 0, transition: spring },
      exit: { opacity: 0, y: 16, transition: spring },
    },
  };
}

export function cardScrollRevealMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1, filter: "blur(0px)", y: 0 },
      whileInView: { opacity: 1, filter: "blur(0px)", y: 0 },
    };
  }

  return {
    initial: { opacity: 0, filter: "blur(10px)", y: 10 },
    whileInView: { opacity: 1, filter: "blur(0px)", y: 0 },
  };
}

/**
 * A page heading whose text is a number that arrives from the server: invisible until the number is final, then it blurs in.
 * No y offset (layout must not move), and under reduced motion there is no blur, only the opacity switch with no duration:
 * the point is that the text never snaps from a placeholder to the number in view.
 */
export function countHeadingMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      hidden: { opacity: 0 },
      shown: { opacity: 1, transition: { duration: 0 } },
    };
  }
  return {
    hidden: { opacity: 0, filter: "blur(10px)" },
    shown: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
  };
}

export function messageEntranceMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: false as const,
      animate: undefined,
      transition: undefined,
    };
  }

  return {
    // Opacity only: a y offset moves the layout while the Ask page is following the stream.
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  };
}
