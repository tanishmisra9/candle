import { Link } from "react-router-dom";

import { Tooltip } from "./ui/Tooltip";

/**
 * Icon-only back link with a tooltip label, ported as-is from Telogify's BackHomeButton: a chevron
 * (22px, stroke 2, round caps), muted at rest, accent with a faint accent wash on hover/press, in a
 * circular hover target (-m-3 + p-3 = a 46px target that still lines the icon up with the content edge).
 * It sits above the page heading on the inner pages (Guide, About). The circle is deliberate even though
 * Candle's controls are otherwise square: the owner asked for Telogify's exact affordance.
 */
export function BackHomeButton() {
  return (
    // describe={false}: the label repeats the link's aria-label, so screen readers don't hear it twice.
    <Tooltip label="Back to home" describe={false}>
      <Link
        to="/"
        aria-label="Back to home"
        className="-m-3 inline-flex shrink-0 items-center justify-center rounded-full p-3 text-muted transition-colors hover:bg-accent/10 hover:text-accent active:bg-accent/20"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
    </Tooltip>
  );
}
