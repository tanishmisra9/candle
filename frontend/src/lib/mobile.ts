import { useEffect, useState } from "react";

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
export const NAV_OFFSET_CLASS = "top-[var(--nav-offset)]";

type ScrollTarget = Window | HTMLElement;

function readMediaQuery(query: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(query).matches;
}

function getScrollValue(target: ScrollTarget) {
  if ("scrollY" in target) {
    return target.scrollY;
  }

  return target.scrollTop;
}

export function useIsMobile(query = MOBILE_MEDIA_QUERY) {
  const [isMobile, setIsMobile] = useState(() => readMediaQuery(query));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}

type UseScrollVisibilityStateOptions = {
  enabled?: boolean;
  hideAfter?: number;
  revealWithin?: number;
  target?: ScrollTarget | null;
};

export function useScrollVisibilityState({
  enabled = true,
  hideAfter = 160,
  revealWithin = 72,
  target = null,
}: UseScrollVisibilityStateOptions = {}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      return;
    }

    const scrollTarget = target ?? (typeof window !== "undefined" ? window : null);
    if (!scrollTarget) {
      return;
    }

    let lastValue = getScrollValue(scrollTarget);

    const onScroll = () => {
      const value = getScrollValue(scrollTarget);
      const delta = value - lastValue;

      if (value <= revealWithin) {
        setIsVisible(true);
      } else if (delta > 4 && value > hideAfter) {
        setIsVisible(false);
      } else if (delta < -4) {
        setIsVisible(true);
      }

      lastValue = value;
    };

    onScroll();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
    };
  }, [enabled, hideAfter, revealWithin, target]);

  return isVisible;
}

const MOBILE_FADE_EASE = [0.22, 1, 0.36, 1] as const;

/** Fade transition for mobile sticky tray show/hide. */
export const MOBILE_TRAY_FADE = {
  duration: 0.22,
  ease: MOBILE_FADE_EASE,
};

/** Fade transition for secondary controls (filters, timeline, linked). */
export const MOBILE_CONTROLS_FADE = {
  duration: 0.18,
  ease: MOBILE_FADE_EASE,
};

export const MOBILE_FADE_VISIBLE = {
  opacity: 1,
} as const;

export const MOBILE_FADE_HIDDEN = {
  opacity: 0,
} as const;

/** Subtle downward offset for list content when mobile tray is visible. */
export const MOBILE_CONTENT_PUSH_OFFSET_PX = 12;

export const MOBILE_CONTENT_PUSH_FADE = {
  duration: 0.22,
  ease: MOBILE_FADE_EASE,
};

export const MOBILE_CONTENT_PUSH_VISIBLE = {
  y: MOBILE_CONTENT_PUSH_OFFSET_PX,
} as const;

export const MOBILE_CONTENT_PUSH_REST = {
  y: 0,
} as const;

type UseStagedMobileControlsVisibilityOptions = {
  enabled?: boolean;
  hideAfter?: number;
  searchRevealWithin?: number;
  fullControlsRevealWithin?: number;
  /** Accumulated upward px before latching search tray visible while deep in page. */
  revealUpAccumPx?: number;
  /** Accumulated downward px before hiding latched search tray. */
  hideDownAccumPx?: number;
  /** Extra px past fullControlsRevealWithin before hiding full controls (hysteresis). */
  fullControlsHysteresisPx?: number;
  target?: ScrollTarget | null;
};

type StagedMobileControlsVisibilityState = {
  showSearch: boolean;
  showFullControls: boolean;
};

export function useStagedMobileControlsVisibility({
  enabled = true,
  hideAfter = 160,
  searchRevealWithin = 72,
  fullControlsRevealWithin = 48,
  revealUpAccumPx = 14,
  hideDownAccumPx = 28,
  fullControlsHysteresisPx = 18,
  target = null,
}: UseStagedMobileControlsVisibilityOptions = {}): StagedMobileControlsVisibilityState {
  const [state, setState] = useState<StagedMobileControlsVisibilityState>({
    showSearch: true,
    showFullControls: true,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ showSearch: true, showFullControls: true });
      return;
    }

    const scrollTarget = target ?? (typeof window !== "undefined" ? window : null);
    if (!scrollTarget) {
      return;
    }

    let lastValue = getScrollValue(scrollTarget);
    let upwardAccum = 0;
    let downwardAccum = 0;

    const onScroll = () => {
      const value = getScrollValue(scrollTarget);
      const delta = value - lastValue;

      if (delta < 0) {
        upwardAccum += -delta;
        downwardAccum = 0;
      } else if (delta > 0) {
        downwardAccum += delta;
        upwardAccum = 0;
      }

      setState((current) => {
        const nearTopForSearch = value <= searchRevealWithin;
        const showFullControls = current.showFullControls
          ? value <= fullControlsRevealWithin + fullControlsHysteresisPx
          : value <= fullControlsRevealWithin;

        if (nearTopForSearch) {
          upwardAccum = 0;
          downwardAccum = 0;
          return { showSearch: true, showFullControls };
        }

        let showSearch = current.showSearch;
        if (value <= hideAfter) {
          showSearch = true;
          upwardAccum = 0;
          downwardAccum = 0;
        } else if (upwardAccum >= revealUpAccumPx) {
          showSearch = true;
        } else if (showSearch && downwardAccum >= hideDownAccumPx) {
          showSearch = false;
          upwardAccum = 0;
          downwardAccum = 0;
        }

        return { showSearch, showFullControls };
      });

      lastValue = value;
    };

    onScroll();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
    };
  }, [
    enabled,
    hideAfter,
    searchRevealWithin,
    fullControlsRevealWithin,
    revealUpAccumPx,
    hideDownAccumPx,
    fullControlsHysteresisPx,
    target,
  ]);

  return state;
}

type UseScrolledPastThresholdOptions = {
  enabled?: boolean;
  threshold?: number;
  target?: ScrollTarget | null;
};

export function useScrolledPastThreshold({
  enabled = true,
  threshold = 28,
  target = null,
}: UseScrolledPastThresholdOptions = {}) {
  const [isPastThreshold, setIsPastThreshold] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsPastThreshold(false);
      return;
    }

    const scrollTarget = target ?? (typeof window !== "undefined" ? window : null);
    if (!scrollTarget) {
      return;
    }

    const onScroll = () => {
      setIsPastThreshold(getScrollValue(scrollTarget) > threshold);
    };

    onScroll();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
    };
  }, [enabled, threshold, target]);

  return isPastThreshold;
}
