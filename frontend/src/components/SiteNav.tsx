import { Flame } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { primaryDestinations } from "../lib/navigation";
import { tabClass } from "../lib/ui";
import { ThemeToggle } from "./ui/ThemeToggle";

// Fixed bar; its height IS --nav-offset (views pad their top and focus margins with it).
export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[var(--nav-offset)] site-nav">
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
