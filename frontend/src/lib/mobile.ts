/** Viewport helpers: `useIsMobile` (matches Tailwind's `md` breakpoint, `max-width: 767px`), and `NAV_OFFSET_CLASS`, the `top` offset that clears the fixed nav (`--nav-offset` in `index.css`). */
import { useEffect, useState } from "react";

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
export const NAV_OFFSET_CLASS = "top-[var(--nav-offset)]";

function readMediaQuery(query: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(query).matches;
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
