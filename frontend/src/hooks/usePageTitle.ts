/** Sets `document.title` from the route so each page has a distinct title (WCAG 2.4.2). */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Candle — CHM research intelligence",
  "/trials": "Trials — Candle",
  "/literature": "Literature — Candle",
  "/ask": "Ask — Candle",
};

export function usePageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? "Candle";
  }, [pathname]);
}
