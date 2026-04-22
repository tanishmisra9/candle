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
