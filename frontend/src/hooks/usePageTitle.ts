/** Sets `document.title` from the route so each page has a distinct title (WCAG 2.4.2). */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Candle — CHM research intelligence",
  "/trials": "Trials — Candle",
  "/literature": "Literature — Candle",
  "/ask": "Ask — Candle",
  "/guide": "Guide — Candle",
  "/about": "About — Candle",
};

export function usePageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Every address that is not listed renders the not-found page, so it is titled as one.
    // "/trials/" renders the Trials page too (React Router ignores a trailing slash), so look the title up without it.
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    document.title = PAGE_TITLES[path] ?? "Page not found — Candle";
  }, [pathname]);
}
