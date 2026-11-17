import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { mobileMenuMotion } from "../lib/motion";
import { lockPageScroll } from "../lib/scrollLock";
import { primaryDestinations } from "../lib/navigation";
import { prefetchRoute } from "../lib/routes";
import { tabClass } from "../lib/ui";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Tooltip } from "./ui/Tooltip";

// Displacement map for the Chromium-only refraction (index.css `html[data-refract]`): neutral grey
// (no shift) except the bottom ~20% of the bar, where the green channel ramps so content behind the
// bottom edge bends like a glass lens. It varies in y only, so it stretches to any bar width.
const REFRACTION_MAP = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%2272%22 viewBox=%220 0 1 72%22 preserveAspectRatio=%22none%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%220%22 y2=%221%22%3E%3Cstop offset=%220%22 stop-color=%22rgb%28128,128,128%29%22/%3E%3Cstop offset=%220.8%22 stop-color=%22rgb%28128,128,128%29%22/%3E%3Cstop offset=%221%22 stop-color=%22rgb%28128,34,128%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%221%22 height=%2272%22 fill=%22url%28%23g%29%22/%3E%3C/svg%3E";

// The inline tabs show from this width up; below it the menu button opens the full-screen menu.
const DESKTOP_NAV_QUERY = "(min-width: 640px)";

/**
 * Behaviour of the full-screen mobile menu (ported from Telogify's Nav and the portfolio's header): the page
 * behind is locked and made `inert` while it is open so keyboard and screen-reader users cannot reach what is
 * hidden under it; Escape closes it and puts focus back on the button; Tab is trapped inside; the first link
 * takes focus; a route change (including back/forward) closes it; and so does growing the window to desktop
 * width, which would otherwise leave an invisible overlay holding the scroll lock and the `inert`.
 */
function useMobileMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const releaseScroll = lockPageScroll(); // <html> and <body>, counted (see lib/scrollLock.ts)
    document.querySelectorAll("main, footer").forEach((element) => element.setAttribute("inert", ""));
    return () => {
      releaseScroll();
      // Re-query rather than reuse what was found on opening: whatever is there now must not stay inert.
      document.querySelectorAll("main, footer").forEach((element) => element.removeAttribute("inert"));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = document.getElementById("mobile-nav-overlay");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !overlay) return;
      // The cycle is the menu button (it is the close control, and it sits OUTSIDE the dialog in the header)
      // followed by the links. Tab never leaves it: from anywhere else (the theme toggle, the page body after a
      // tap on the backdrop) it pulls focus back in, to the first link (or the last one with Shift).
      const links = Array.from(overlay.querySelectorAll<HTMLElement>("a[href]"));
      const cycle = triggerRef.current ? [triggerRef.current, ...links] : links;
      if (cycle.length === 0) return;
      event.preventDefault();
      const index = cycle.indexOf(document.activeElement as HTMLElement);
      if (index === -1) {
        (event.shiftKey ? cycle[cycle.length - 1] : (links[0] ?? cycle[0])).focus();
        return;
      }
      cycle[(index + (event.shiftKey ? -1 : 1) + cycle.length) % cycle.length].focus();
    };
    const frame = requestAnimationFrame(() => overlay?.querySelector<HTMLElement>("a[href]")?.focus());
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP_NAV_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open]);

  return { open, setOpen, triggerRef };
}

// Fixed bar; its height IS --nav-offset (views pad their top and focus margins with it).
export function SiteNav() {
  const { open, setOpen, triggerRef } = useMobileMenu();
  const reducedMotion = useReducedMotion();
  const menuMotion = mobileMenuMotion(reducedMotion);
  const iconFade = { duration: reducedMotion ? 0 : 0.15 };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 h-[var(--nav-offset)] site-nav">
        <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
          <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage href={REFRACTION_MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="mx-auto flex h-full max-w-[1360px] items-stretch justify-between gap-2 px-4 sm:px-5 md:px-10">
          <Link to="/" className="flex min-h-11 min-w-11 items-center justify-center gap-2.5 self-center rounded-panel">
            <Flame size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            {/* Always shown. It used to collapse to the icon below 420px "so the bar never overflows at 320px", from before the phone
                menu button: measured now, the bar has 117px to spare at 320px WITH the name, so a phone showed a flame, a moon
                and a hamburger and never said what the product was called. */}
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-text">Candle</span>
          </Link>

          <div className="flex items-stretch gap-0.5 sm:gap-2">
            <nav aria-label="Primary" className="hidden items-stretch sm:flex sm:gap-1">
              {primaryDestinations.map((item) => (
                // `flex items-stretch` on the wrapper: the tab's underline sits on the bar's bottom edge, so the link must still fill its height.
                <Tooltip key={item.to} label={item.hint} className="flex items-stretch">
                  <NavLink
                    to={item.to}
                    end
                    onPointerEnter={() => prefetchRoute(item.to)}
                    onFocus={() => prefetchRoute(item.to)}
                    onTouchStart={() => prefetchRoute(item.to)}
                    className={({ isActive }) =>
                      tabClass(isActive, "px-2.5 sm:px-3 md:px-4 md:text-[15px]")
                    }
                  >
                    {item.label}
                  </NavLink>
                </Tooltip>
              ))}
            </nav>
            <div className="flex items-center">
              <ThemeToggle />
              <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-controls="mobile-nav-overlay"
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((current) => !current)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-panel text-text transition-colors hover:bg-text/10 sm:hidden"
              >
                {/* The two icons cross-fade in one grid cell (no layout shift between them). */}
                <span className="relative grid place-items-center">
                  <motion.span
                    aria-hidden="true"
                    style={{ gridArea: "1 / 1" }}
                    initial={false}
                    animate={{ opacity: open ? 0 : 1 }}
                    transition={iconFade}
                  >
                    <Menu size={20} strokeWidth={1.5} />
                  </motion.span>
                  <motion.span
                    aria-hidden="true"
                    style={{ gridArea: "1 / 1" }}
                    initial={false}
                    animate={{ opacity: open ? 1 : 0 }}
                    transition={iconFade}
                  >
                    <X size={20} strokeWidth={1.5} />
                  </motion.span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* A SIBLING of the header, not a child: the header's glass uses a backdrop-filter, and (like transform or
          filter) that makes it the containing block for `position: fixed` descendants, which collapsed the
          overlay into the header's own height instead of the viewport (found in Telogify). */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-nav-overlay"
            id="mobile-nav-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            // z-[55]: above the Ask composer (40) and the scroll-to-top button (50), which are `fixed` inside <main>
            // and would otherwise paint over the "full-screen" menu; below the trial/publication dialogs (60+).
            // touch-none + overscroll-contain: a drag on the menu must not scroll the page behind it.
            className="fixed inset-x-0 bottom-0 top-[var(--nav-offset)] z-[55] flex touch-none flex-col overscroll-contain bg-canvas sm:hidden"
            {...menuMotion.overlay}
            // A tap anywhere that is not a link (the empty space around them) closes it. Not
            // `target === currentTarget`: the list fills the overlay, so that never matched.
            onClick={(event) => {
              if (!(event.target as Element).closest("a[href]")) setOpen(false);
            }}
          >
            <motion.ul
              aria-label="Sections"
              className="flex grow list-none flex-col items-center justify-center gap-6 px-6"
              variants={menuMotion.list}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {primaryDestinations.map((item) => (
                <motion.li key={item.to} variants={menuMotion.item}>
                  <NavLink
                    to={item.to}
                    end
                    // A tap on the CURRENT page's link does not change the route, so the route effect never
                    // fires: the link closes the menu itself.
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `inline-block border-b-2 py-2 text-[2.5rem] font-semibold leading-none tracking-tight transition-colors ${
                        isActive ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
