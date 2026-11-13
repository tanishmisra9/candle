/** TanStack Query defaults: 5 min stale time and one retry. `catalogQueryOptions` is for rarely-changing catalog data (spread into the list views' queries): 30 min stale time. */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const catalogQueryOptions = {
  staleTime: 30 * 60_000,
  gcTime: 60 * 60_000,
  refetchOnWindowFocus: false,
} as const;
