/** Last successful ingest time (`GET /sync/last-synced`) for the "Data last synced" label. Cached for the session. */
import { useQuery } from "@tanstack/react-query";

import { getSyncLastSynced } from "../lib/api";

export function formatLastSynced(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

const DAY_MS = 86_400_000;
/** Younger than this, the date alone is enough; older, the label says how old (a stale "Recruiting" needs that next to it). */
const STALE_AFTER_DAYS = 14;

/** "3 weeks ago" / "3 months ago" / "1 year ago", or null when the data is fresh (under 14 days), in the future or not a date. */
export function formatSyncAge(value: string, now = Date.now()): string | null {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((now - then) / DAY_MS);
  if (days < STALE_AFTER_DAYS) return null;
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (days < 63) return plural(Math.floor(days / 7), "week");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}

export function useLastSynced() {
  return useQuery({
    queryKey: ["sync", "last-synced"],
    queryFn: getSyncLastSynced,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
