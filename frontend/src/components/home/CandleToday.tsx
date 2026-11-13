/**
 * "Right now Candle follows N trials and M publications. Last updated D." Written as a sentence,
 * not a stat banner. Reuses the totals queries that the Trials and Literature pages already use
 * (same keys, so the cache is shared). While loading, or if the API is down, it shows nothing
 * rather than zeros; the space is reserved so the page never jumps.
 */
import { useQuery } from "@tanstack/react-query";

import { formatLastSynced, useLastSynced } from "../../hooks/useLastSynced";
import { listPublicationsPage, listTrialsPage } from "../../lib/api";
import { catalogQueryOptions } from "../../lib/queryClient";

const plural = (count: number, one: string, many: string) =>
  `${new Intl.NumberFormat().format(count)} ${count === 1 ? one : many}`;

export function CandleToday() {
  const trials = useQuery({
    queryKey: ["trials", "total"],
    queryFn: () => listTrialsPage({ envelope: "true", limit: 1 }),
    ...catalogQueryOptions,
  });
  const publications = useQuery({
    queryKey: ["publications", "total"],
    queryFn: () => listPublicationsPage({ envelope: "true", limit: 1 }),
    ...catalogQueryOptions,
  });
  const synced = useLastSynced();

  const trialTotal = trials.data?.total;
  const publicationTotal = publications.data?.total;
  const date = synced.data?.last_synced ? formatLastSynced(synced.data.last_synced) : null;
  const ready = trialTotal !== undefined && publicationTotal !== undefined;

  return (
    <p className="mt-10 min-h-[3.5rem] text-[1.125rem] leading-[1.7] text-muted">
      {ready ? (
        <>
          Right now Candle follows {plural(trialTotal, "clinical trial", "clinical trials")} and{" "}
          {plural(publicationTotal, "publication", "publications")}.
          {date ? ` Last updated ${date}.` : null}
        </>
      ) : null}
    </p>
  );
}
