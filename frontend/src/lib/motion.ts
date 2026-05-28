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

export function messageEntranceMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: false as const,
      animate: undefined,
      transition: undefined,
    };
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28 },
  };
}
