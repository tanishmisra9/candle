import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PublicationRow } from "../components/PublicationRow";
import { PublicationRowSkeleton } from "../components/PublicationRowSkeleton";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import clsx from "clsx";
import { listPublicationsPage } from "../lib/api";
import { catalogQueryOptions } from "../lib/queryClient";
import type { PublicationSummary } from "../types";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const kbdShortcut = isMac ? "⌘K" : "Ctrl+K";
const PAGE_SIZE = 50;

type LiteratureViewProps = {
  onOpenPublicationSnapshot: (publication: PublicationSummary) => void;
};

export function LiteratureView({ onOpenPublicationSnapshot }: LiteratureViewProps) {
  const publicationPageSize = 200;
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreScrollRef = useRef<number | null>(null);
  const searchFieldId = useId();
  const normalizedSearch = search.trim();
  const publicationQueryParams = useMemo(
    () => ({
      envelope: "true" as const,
      limit: publicationPageSize,
      q: normalizedSearch || undefined,
      linked_only: linkedOnly,
    }),
    [linkedOnly, normalizedSearch, publicationPageSize],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const publicationsQuery = useInfiniteQuery({
    queryKey: ["publications", "cursor", publicationQueryParams],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listPublicationsPage({
        ...publicationQueryParams,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    ...catalogQueryOptions,
  });

  const unfilteredPublicationsQuery = useQuery({
    queryKey: ["publications", "total"],
    queryFn: () => listPublicationsPage({ envelope: "true", limit: 1 }),
    ...catalogQueryOptions,
  });

  useEffect(() => {
    setPage(0);
  }, [normalizedSearch, linkedOnly, sortOrder]);

  useEffect(() => {
    if (publicationsQuery.hasNextPage && !publicationsQuery.isFetchingNextPage) {
      void publicationsQuery.fetchNextPage();
    }
  }, [
    publicationsQuery.fetchNextPage,
    publicationsQuery.hasNextPage,
    publicationsQuery.isFetchingNextPage,
  ]);

  const publications = publicationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const publicationTotal = publicationsQuery.data?.pages[0]?.total ?? publications.length;
  const unfilteredPublicationTotal =
    unfilteredPublicationsQuery.data?.total ?? publicationTotal;
  const hasFilters = Boolean(normalizedSearch || linkedOnly);
  const showPublicationSkeletons = publicationsQuery.isPending;

  const sortedPublications = useMemo(() => {
    const copy = [...publications];
    copy.sort((a, b) => {
      if (a.pub_date === b.pub_date) {
        return a.pmid < b.pmid ? -1 : 1;
      }
      if (!a.pub_date) {
        return 1;
      }
      if (!b.pub_date) {
        return -1;
      }
      const asc = a.pub_date < b.pub_date ? -1 : 1;
      return sortOrder === "newest" ? -asc : asc;
    });
    return copy;
  }, [publications, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedPublications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sortedPublications.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  const goToPage = (updater: (current: number) => number) => {
    // Capture the offset before the slice swaps so the layout-height change on
    // the new page does not clamp the window scroll toward the top.
    restoreScrollRef.current = window.scrollY;
    setPage(updater);
  };

  useLayoutEffect(() => {
    if (restoreScrollRef.current === null) {
      return;
    }
    window.scrollTo(0, restoreScrollRef.current);
    restoreScrollRef.current = null;
  }, [currentPage]);

  const literatureControls = (
    <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-3">
      <div className="relative w-full md:w-[420px]">
        <label htmlFor={searchFieldId} className="sr-only">
          Search title or abstract
        </label>
        <Search
          size={17}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={searchFieldId}
          ref={inputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or abstract"
          className={clsx(
            "w-full rounded-full border border-line bg-glass pl-11 pr-14 text-[14px] text-text shadow-panel outline-none backdrop-blur-2xl placeholder:text-muted transition-all focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "text-[16px]",
            "py-3.5",
          )}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
          {kbdShortcut}
        </span>
      </div>

      <div className="inline-flex self-start rounded-full border border-line bg-glass p-1 backdrop-blur-2xl md:self-auto">
        <button
          type="button"
          onClick={() => setSortOrder("newest")}
          className={clsx(
            "focus-ring rounded-full px-5 py-2.5 text-[14px] font-medium transition",
            sortOrder === "newest" ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
          )}
          aria-pressed={sortOrder === "newest"}
        >
          Newest
        </button>
        <button
          type="button"
          onClick={() => setSortOrder("oldest")}
          className={clsx(
            "focus-ring rounded-full px-5 py-2.5 text-[14px] font-medium transition",
            sortOrder === "oldest" ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
          )}
          aria-pressed={sortOrder === "oldest"}
        >
          Oldest
        </button>
      </div>

      <div className="inline-flex self-start rounded-full border border-line bg-glass p-1 backdrop-blur-2xl md:self-auto">
        <button
          type="button"
          onClick={() => setLinkedOnly((current) => !current)}
          className={clsx(
            "focus-ring rounded-full px-5 py-2.5 text-[14px] font-medium transition",
            linkedOnly ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
          )}
          aria-pressed={linkedOnly}
          aria-label={
            linkedOnly
              ? "Showing linked publications only. Activate to show all publications."
              : "Activate to show linked publications only."
          }
        >
          Linked
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 pt-28 md:space-y-12 md:pt-32">
      <header className="space-y-2">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {hasFilters
            ? `Showing ${publicationTotal} of ${unfilteredPublicationTotal} publications`
            : `${publicationTotal} publications tracked`}
        </h1>
      </header>

      <div className="space-y-8 md:space-y-12">
        <div className="glass-nav flex w-full flex-col gap-4 rounded-[24px] px-4 py-4 md:w-fit md:self-start">
          {literatureControls}
        </div>

        <div className="space-y-8 md:space-y-12">
          {publicationsQuery.isError ? (
            <div className="rounded-card border border-line bg-panel p-6 text-[15px] text-muted">
              <p>Publications could not be loaded.</p>
              <button
                type="button"
                className="focus-ring mt-4 rounded-full border border-line px-4 py-2 text-[14px] text-text"
                onClick={() => void publicationsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className="rounded-card border border-line bg-panel px-4 shadow-panel md:px-8">
            {showPublicationSkeletons
              ? Array.from({ length: 8 }).map((_, index) => (
                  <PublicationRowSkeleton key={`publication-skeleton-${index}`} />
                ))
              : null}

            {!showPublicationSkeletons ? (
              <div>
                {pageItems.map((publication) => (
                  <PublicationRow
                    key={publication.pmid}
                    publication={publication}
                    query={normalizedSearch}
                    onOpen={onOpenPublicationSnapshot}
                  />
                ))}
              </div>
            ) : null}

            {!showPublicationSkeletons && !sortedPublications.length ? (
              <div className="px-2 py-12 text-[15px] text-muted">
                No publications matched this filter.
              </div>
            ) : null}
          </div>

          {!showPublicationSkeletons && sortedPublications.length > PAGE_SIZE ? (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 0}
                onClick={() => goToPage((current) => Math.max(0, current - 1))}
                className="focus-ring rounded-full border border-line p-2.5 text-text disabled:opacity-40"
              >
                <ChevronLeft size={18} strokeWidth={1.75} />
              </button>
              <span className="text-[14px] text-muted tabular-nums">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages - 1}
                onClick={() => goToPage((current) => Math.min(totalPages - 1, current + 1))}
                className="focus-ring rounded-full border border-line p-2.5 text-text disabled:opacity-40"
              >
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
