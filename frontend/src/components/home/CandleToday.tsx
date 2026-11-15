/**
 * "Right now Candle follows N trials and M publications." (The sync date lives in the footer.) Written as a sentence,
 * not a stat banner. Reuses the totals queries that the Trials and Literature pages already use
 * (same keys, so the cache is shared). While loading, or if the API is down, it shows nothing
 * rather than zeros; the space is reserved so the page never jumps.
 */
import { useQuery } from "@tanstack/react-query";

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

  const trialTotal = trials.data?.total;
  const publicationTotal = publications.data?.total;
  const ready = trialTotal !== undefined && publicationTotal !== undefined;

  return (
    <p className="mt-6 min-h-[3.5rem] text-[1.0625rem] leading-[1.6] text-muted sm:mt-8 sm:min-h-[1.75rem] sm:text-[1.125rem] sm:leading-[1.7]">
      {ready ? (
        <>
          Right now Candle follows {plural(trialTotal, "clinical trial", "clinical trials")} and{" "}
          {plural(publicationTotal, "publication", "publications")}.
        </>
      ) : null}
    </p>
  );
}
