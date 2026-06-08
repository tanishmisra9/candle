import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

import { getSyncLastSynced } from "../lib/api";

export function formatLastSynced(value: string): string | null {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return format(parsed, "MMM d, yyyy");
}

export function useLastSynced() {
  return useQuery({
    queryKey: ["sync", "last-synced"],
    queryFn: getSyncLastSynced,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
