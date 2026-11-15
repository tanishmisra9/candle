import { Link, useLocation } from "react-router-dom";

import { prefetchRoute } from "../lib/routes";
import { LastSyncedLabel } from "./LastSyncedLabel";

const linkClass =
  "inline-flex min-h-11 items-center px-2 text-[14px] font-medium text-accent underline underline-offset-4 hover:text-text";

// The footer is where the guide and the about page live (the nav stays at three tabs). The disclaimer
// is on every page that has a footer, not only the landing page.
const FOOTER_LINKS = [
  { to: "/guide", label: "New to CHM? Read the guide" },
  { to: "/about", label: "About Candle" },
] as const;

export function Footer() {
  const location = useLocation();

  // On the Ask page the sync label is rendered below the fixed input bar instead.
  if (location.pathname === "/ask") {
    return null;
  }

  // On the landing page the same two links are the NextSteps band right above, so they are not repeated.
  const onHome = location.pathname === "/";

  return (
    // footer-reveal: fades in AFTER the page above it (see index.css), never before it.
    <footer className="footer-reveal mx-auto w-full max-w-[1360px] px-4 pb-6 pt-2 text-center sm:px-5 md:px-10">
      {onHome ? null : (
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4">
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={linkClass}
              onPointerEnter={() => prefetchRoute(to)}
              onFocus={() => prefetchRoute(to)}
              onTouchStart={() => prefetchRoute(to)}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      <p className="text-xs text-muted">Candle does not give medical advice.</p>
      <LastSyncedLabel className="mt-1" />
    </footer>
  );
}
