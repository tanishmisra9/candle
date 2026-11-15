/**
 * The two secondary destinations (Guide, About) as two whole-surface tiles under the hero (see
 * components/LinkTile.tsx for the look: no underline, no arrow, an accent outline around the whole tile
 * on hover/focus). Replaces the two small footer links on the landing page (the footer drops them
 * there). Routes are prefetched on hover/focus/touch like the nav tabs.
 */
import { LinkTile } from "../LinkTile";
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
    <nav aria-label="More about Candle" className="reveal reveal-6 mx-auto w-full max-w-[56rem] pb-12 pt-2">
      <ul className="grid gap-4 md:grid-cols-2">
        {STEPS.map(({ to, title, body }) => (
          <li key={to} className="flex">
            <LinkTile to={to} title={title} body={body} onPrefetch={() => prefetchRoute(to)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
