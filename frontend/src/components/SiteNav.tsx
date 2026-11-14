import { Flame } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { primaryDestinations } from "../lib/navigation";
import { prefetchRoute } from "../lib/routes";
import { tabClass } from "../lib/ui";
import { ThemeToggle } from "./ui/ThemeToggle";

// Displacement map for the Chromium-only refraction (index.css `html[data-refract]`): neutral grey
// (no shift) except the bottom ~20% of the bar, where the green channel ramps so content behind the
// bottom edge bends like a glass lens. It varies in y only, so it stretches to any bar width.
const REFRACTION_MAP = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%2272%22 viewBox=%220 0 1 72%22 preserveAspectRatio=%22none%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%220%22 y2=%221%22%3E%3Cstop offset=%220%22 stop-color=%22rgb%28128,128,128%29%22/%3E%3Cstop offset=%220.8%22 stop-color=%22rgb%28128,128,128%29%22/%3E%3Cstop offset=%221%22 stop-color=%22rgb%28128,34,128%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%221%22 height=%2272%22 fill=%22url%28%23g%29%22/%3E%3C/svg%3E";

// Fixed bar; its height IS --nav-offset (views pad their top and focus margins with it).
export function SiteNav() {
  return (
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
          {/* Wordmark collapses to the icon below 420px so the bar never overflows at 320px. */}
          <span className="sr-only text-[16px] font-semibold tracking-[-0.01em] text-text min-[420px]:not-sr-only">
            Candle
          </span>
        </Link>

        <div className="flex items-stretch gap-0.5 sm:gap-2">
          <nav aria-label="Primary" className="flex items-stretch sm:gap-1">
            {primaryDestinations.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onPointerEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                onTouchStart={() => prefetchRoute(item.to)}
                className={({ isActive }) =>
                  tabClass(isActive, "px-2.5 sm:px-3 md:px-4 md:text-[15px]")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
