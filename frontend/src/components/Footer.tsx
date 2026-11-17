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

// Pages whose footer carries the "Visit the CureCHM patient community" link (it used to sit in the About note).
const CURECHM_PAGES = ["/", "/guide", "/about"];

export function Footer() {
  const location = useLocation();

  // ONE normalised path for every decision below. The router matches routes case-insensitively and with
  // a trailing slash ("/Guide", "/ask/"), so the footer must see the same page the router rendered.
  const path = location.pathname.replace(/\/+$/, "").toLowerCase() || "/";

  // On the Ask page the sync label is rendered below the fixed input bar instead.
  if (path === "/ask") {
    return null;
  }

  // A link to the page you are already on is noise, so it is left out: no "Read the guide" on the guide,
  // no "About Candle" on the about page. On the landing page both go (the NextSteps band right above
  // has them).
  const links = path === "/" ? [] : FOOTER_LINKS.filter(({ to }) => to !== path);
  // The foundation's community link sits in the footer of the landing page and the two inner pages.
  const showCureChm = CURECHM_PAGES.includes(path);

  return (
    // footer-reveal: fades in AFTER the page above it (see index.css), never before it.
    // max-sm:pb-20: the scroll-to-top button floats 24-68px above the bottom edge on the list pages, so on a phone the last footer
    // lines sat under it ("Candle does not give medical advice." at 320px, the sync age at 360px). 80px puts them above that band.
    <footer className="footer-reveal mx-auto w-full max-w-[1360px] px-4 pb-6 pt-2 text-center max-sm:pb-20 sm:px-5 md:px-10">
      {links.length === 0 && !showCureChm ? null : (
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4">
          {links.map(({ to, label }) => (
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
          {showCureChm ? (
            <a href="https://curechm.org" target="_blank" rel="noreferrer" className={linkClass}>
              Visit the CureCHM patient community
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </nav>
      )}
      <p className="text-xs text-muted">Candle does not give medical advice.</p>
      <LastSyncedLabel className="mt-1" />
      {/* The release number: package.json is the single source (docs/CONTRIBUTING.md, "Versioning"). */}
      <p className="mt-1 text-xs text-muted">Version {__APP_VERSION__}</p>
    </footer>
  );
}
