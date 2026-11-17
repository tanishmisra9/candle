/**
 * Not found (any address that is not a page): says so, and offers the two main places to go. Without it an unknown address
 * (for example /trials/NCT03496012, which people try) rendered an empty main area with the nav and footer around it.
 * Same page shell as Guide and About.
 */
import { BackHomeButton } from "../components/BackHomeButton";
import { LinkTile } from "../components/LinkTile";
import { prefetchRoute } from "../lib/routes";

export function NotFoundView() {
  return (
    <div className="px-4 pt-28 sm:px-0 md:pt-32">
      <BackHomeButton />
      <h1 className="mt-6 text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        Page not found
      </h1>
      <p className="mt-4 max-w-[40rem] text-balance text-[1.125rem] leading-[1.6] text-muted">
        That address does not match a page on Candle. The trials and the research are one tap away.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <LinkTile to="/trials" onPrefetch={() => prefetchRoute("/trials")} title="Trials" body="Browse every CHM clinical trial." />
        <LinkTile
          to="/literature"
          onPrefetch={() => prefetchRoute("/literature")}
          title="Literature"
          body="Read CHM papers with summaries and source links."
        />
      </div>
    </div>
  );
}
