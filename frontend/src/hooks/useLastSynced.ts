import { useQuery } from "@tanstack/react-query";

import { getSyncLastSynced } from "../lib/api";

export function formatLastSynced(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export function useLastSynced() {
  return useQuery({
    queryKey: ["sync", "last-synced"],
    queryFn: getSyncLastSynced,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
