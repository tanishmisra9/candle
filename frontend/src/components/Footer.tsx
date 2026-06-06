import { useQuery } from "@tanstack/react-query";
import { differenceInDays, format, formatDistanceToNow, parseISO } from "date-fns";

import { getSyncLastSynced } from "../lib/api";

function formatLastSynced(value: string) {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (differenceInDays(new Date(), parsed) > 30) {
    return format(parsed, "MMM d, yyyy");
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
}

export function Footer() {
  const syncQuery = useQuery({
    queryKey: ["sync", "last-synced"],
    queryFn: getSyncLastSynced,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (syncQuery.isPending || syncQuery.isError || !syncQuery.data?.last_synced) {
    return null;
  }

  const formatted = formatLastSynced(syncQuery.data.last_synced);
  if (!formatted) {
    return null;
  }

  return (
    <footer className="mx-auto max-w-[1360px] px-4 pb-10 pt-2 text-xs text-muted/70 sm:px-5 md:px-10">
      Data last synced: {formatted}
    </footer>
  );
}
