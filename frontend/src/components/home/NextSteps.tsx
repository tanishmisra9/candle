/**
 * The two secondary destinations (Guide, About) as a roomy band under the hero: a ruled two-column
 * row, each a whole-row link with a title, one line saying what is there, and an arrow. Replaces the
 * two small footer links on the landing page (the footer drops them there). Routes are prefetched on
 * hover/focus/touch like the nav tabs.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { prefetchRoute } from "../../lib/routes";

const STEPS = [
  {
    to: "/guide",
    title: "Read the guide",
    body: "New to CHM? Learn what the condition is and how to read a trial’s phase and status.",
  },
  {
    to: "/about",
    title: "About Candle",
    body: "What Candle does and doesn’t do, and a note from the builder.",
  },
] as const;

export function NextSteps() {
  return (
    // reveal-6: part of the intro's top-to-bottom sequence (after the counts, before the footer).
    <nav aria-label="More about Candle" className="reveal reveal-6 mx-auto w-full max-w-[56rem] border-t border-line pb-12">
      <ul className="grid md:grid-cols-2">
        {STEPS.map(({ to, title, body }) => (
          // Padding sits on the <li> (the link is each li's only child, so `first:` on the link would match both).
          <li
            key={to}
            className="border-line max-md:border-t max-md:first:border-t-0 md:border-l md:first:border-l-0 md:first:pr-10 md:last:pl-10"
          >
            <Link
              to={to}
              onPointerEnter={() => prefetchRoute(to)}
              onFocus={() => prefetchRoute(to)}
              onTouchStart={() => prefetchRoute(to)}
              className="group flex min-h-[8.5rem] items-center justify-between gap-6 py-10"
            >
              <span>
                <span className="block text-[1.5rem] font-semibold leading-snug tracking-tight underline-offset-4 group-hover:underline">
                  {title}
                </span>
                <span className="mt-2 block max-w-[24rem] text-[1.0625rem] leading-[1.6] text-muted">{body}</span>
              </span>
              <ArrowRight
                size={22}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0 text-accent transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
