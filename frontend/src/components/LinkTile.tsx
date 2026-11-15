/**
 * A link presented as a whole-surface tile: a filled surface with a hairline border, a surface shade and
 * an accent outline around the WHOLE tile on hover/focus (the border turns accent and an inset 1px ring
 * doubles it to 2px, so nothing shifts), the title going accent, and the description in full-strength
 * text colour. No underline and no arrow (owner decision). Shared by the landing page's Guide / About
 * choices (internal `to`) and the About page's press-release / LinkedIn links (external `href`).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const TILE =
  "group block w-full rounded-panel border border-line bg-panel px-6 py-8 text-left sm:px-8 sm:py-9 transition-[background-color,border-color,box-shadow] duration-200 hover:border-accent hover:bg-text/5 hover:ring-1 hover:ring-inset hover:ring-accent focus-visible:border-accent active:bg-text/10 motion-reduce:transition-none";

type LinkTileProps = { title: string; body: string } & (
  | {
      /** An in-app route, prefetched on pointer enter / focus / touch. */
      to: string;
      onPrefetch?: () => void;
      href?: never;
    }
  | {
      /** An external address: opens in a new tab, and says so to screen readers. */
      href: string;
      to?: never;
      onPrefetch?: never;
    }
);

export function LinkTile({ title, body, to, href, onPrefetch }: LinkTileProps) {
  const content: ReactNode = (
    <>
      <span className="block text-[1.5rem] font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent group-focus-visible:text-accent motion-reduce:transition-none">
        {title}
      </span>
      <span className="mt-3 block max-w-[26rem] text-[1.0625rem] leading-[1.6] text-text">{body}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={TILE}>
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link to={to} className={TILE} onPointerEnter={onPrefetch} onFocus={onPrefetch} onTouchStart={onPrefetch}>
      {content}
    </Link>
  );
}
