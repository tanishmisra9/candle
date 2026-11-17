/** Literature page (`/literature`): search, sort, linked-only filter, client-side pagination (50 per page). Auto-loads every page from the API first because sorting needs the full set. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PublicationRow } from "../components/PublicationRow";
import { PublicationRowSkeleton } from "../components/PublicationRowSkeleton";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import { listPublicationsPage } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { catalogQueryOptions } from "../lib/queryClient";
import { tabClass } from "../lib/ui";
import { Input } from "../components/ui/Input";
import { ToggleButton } from "../components/ui/ToggleButton";
import { Tooltip } from "../components/ui/Tooltip";
import { cardScrollRevealMotion, listContentSwapMotion } from "../lib/motion";
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollToListRef = useRef(false);
  const searchFieldId = useId();
  const normalizedSearch = search.trim();
  // The request waits for a pause in typing; the old rows stay on screen meanwhile (keepPreviousData).
  const requestedSearch = useDebouncedValue(normalizedSearch);
  const publicationQueryParams = useMemo(
    () => ({
      envelope: "true" as const,
      limit: publicationPageSize,
      q: requestedSearch || undefined,
      linked_only: linkedOnly,
    }),
    [linkedOnly, requestedSearch, publicationPageSize],
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
    placeholderData: keepPreviousData,
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
  const showPublicationSkeletons = publicationsQuery.isPending || publicationsQuery.hasNextPage;
  const prefersReducedMotion = useReducedMotion();
  const swapMotion = listContentSwapMotion(prefersReducedMotion);
  const cardMotion = cardScrollRevealMotion(prefersReducedMotion);

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

  // Moves from the page actually SHOWN (clamped), not from the raw `page` state: if the list shrank under a stale page,
  // "Previous" from state 4 while 2 is shown used to land on 3, clamp to 2 again and look dead. The scroll/focus flag is
  // only armed when the shown page really changes, or it would stay armed and fire on some later, unrelated change.
  const goToPage = (delta: number) => {
    const target = Math.min(totalPages - 1, Math.max(0, currentPage + delta));
    if (target !== currentPage) scrollToListRef.current = true;
    setPage(target);
  };

  // A page change leaves you at the top of the new page (the buttons sit at the bottom, so keeping the scroll
  // offset used to land you at the END of the next page), with the first row focused for keyboard users.
  useLayoutEffect(() => {
    if (!scrollToListRef.current) {
      return;
    }
    scrollToListRef.current = false;
    listRef.current?.scrollIntoView?.({ block: "start" });
    listRef.current?.querySelector("button")?.focus({ preventScroll: true });
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
        <Input
          id={searchFieldId}
          ref={inputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or abstract"
          className="pl-11 md:pr-16"
        />
        <span className="kicker pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-panel border border-line px-2 py-1 text-[11px] text-muted md:block">
          {kbdShortcut}
        </span>
      </div>

      {/* On a phone the sort tabs sit on the left and the Linked toggle on the right, ONE row of controls (they
          were three stacked rows with Linked stranded under the tabs). From md `contents` dissolves this
          wrapper, so on desktop the search, the tabs and Linked are one row as before. */}
      <div className="flex items-center justify-between gap-3 md:contents">
        <div role="group" aria-label="Sort order" className="inline-flex items-stretch">
          <button
            type="button"
            onClick={() => setSortOrder("newest")}
            className={tabClass(sortOrder === "newest", "px-3 sm:px-4")}
            aria-pressed={sortOrder === "newest"}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSortOrder("oldest")}
            className={tabClass(sortOrder === "oldest", "px-3 sm:px-4")}
            aria-pressed={sortOrder === "oldest"}
          >
            Oldest
          </button>
        </div>

        <ToggleButton
          pressed={linkedOnly}
          onClick={() => setLinkedOnly((current) => !current)}
          aria-label={
            linkedOnly
              ? "Showing linked publications only. Activate to show all publications."
              : "Activate to show linked publications only."
          }
        >
          Linked
        </ToggleButton>
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
        <div className="flex w-full flex-col gap-4 rounded-panel border border-line bg-panel px-4 py-4 md:w-fit md:self-start">
          {literatureControls}
        </div>

        <div className="space-y-8 md:space-y-12">
          {publicationsQuery.isError ? (
            <div className="rounded-panel border border-line bg-panel p-6 text-[15px] text-muted">
              <p>Publications could not be loaded.</p>
              <button
                type="button"
                className="mt-4 min-h-11 rounded-panel border border-line-strong px-4 py-2 text-[14px] text-text hover:bg-text/5"
                onClick={() => void publicationsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div ref={listRef} className="scroll-mt-[var(--nav-offset)] rounded-panel border border-line bg-panel px-4 md:px-8">
            <AnimatePresence mode="wait" initial={false}>
              {showPublicationSkeletons ? (
                <motion.div
                  key="skeleton"
                  initial={swapMotion.initial}
                  animate={swapMotion.animate}
                  exit={swapMotion.exit}
                >
                  {Array.from({ length: 8 }).map((_, index) => (
                    <PublicationRowSkeleton key={`publication-skeleton-${index}`} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={swapMotion.initial}
                  animate={swapMotion.animate}
                  exit={swapMotion.exit}
                >
                  {pageItems.map((publication, index) => (
                    <motion.div
                      key={publication.pmid}
                      layout="position"
                      initial={cardMotion.initial}
                      whileInView={cardMotion.whileInView}
                      viewport={{ once: true, margin: "0px" }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 20,
                        delay: prefersReducedMotion ? 0 : index < 6 ? index * 0.04 : 0,
                      }}
                    >
                      <PublicationRow
                        publication={publication}
                        query={normalizedSearch}
                        onOpen={onOpenPublicationSnapshot}
                      />
                    </motion.div>
                  ))}
                  {!sortedPublications.length ? (
                    <div className="space-y-4 px-2 py-12 text-[15px] text-muted">
                      <p>
                        {/* requestedSearch, not the live box: with keepPreviousData the rows on screen answer the debounced
                            query, so naming a half-typed term here would describe a search that has not run yet. */}
                        {requestedSearch
                          ? `No publications match “${requestedSearch}”${linkedOnly ? " among papers linked to a trial" : ""}.`
                          : linkedOnly
                            ? "No publications are linked to a trial yet."
                            : "No publications are tracked yet."}
                      </p>
                      {requestedSearch || linkedOnly ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setLinkedOnly(false);
                          }}
                          className="min-h-11 rounded-panel border border-line-strong px-4 py-2 text-[14px] text-text hover:bg-text/5"
                        >
                          Clear search and filters
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!showPublicationSkeletons && sortedPublications.length > PAGE_SIZE ? (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Tooltip label="Previous page" describe={false}>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage === 0}
                  onClick={() => goToPage(-1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-panel border border-line-strong text-text hover:bg-text/5 disabled:opacity-40"
                >
                  <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
              <span className="text-[14px] text-muted tabular-nums">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Tooltip label="Next page" describe={false}>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => goToPage(1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-panel border border-line-strong text-text hover:bg-text/5 disabled:opacity-40"
                >
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
