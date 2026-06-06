import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { FilterBar } from "../components/FilterBar";
import { Timeline } from "../components/Timeline";
import { TrialCard } from "../components/TrialCard";
import { TrialCardSkeleton } from "../components/TrialCardSkeleton";
import { listTrialsPage } from "../lib/api";
import { cn } from "../lib/cn";
import { catalogQueryOptions } from "../lib/queryClient";
import {
  formatInterventionTypeLabel,
  formatPhaseLabel,
  formatStatusLabel,
} from "../lib/formatters";
import type { TrialSummary } from "../types";

type ViewMode = "grid" | "timeline";
type TrialFacetKey = "status" | "phase" | "intervention_type" | "sponsor";

function uniqueOptions(trials: TrialSummary[], key: keyof TrialSummary) {
  return Array.from(
    new Set(
      trials
        .map((trial) => trial[key])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function matchesTrialSearch(trial: TrialSummary, normalizedSearch: string) {
  if (!normalizedSearch) {
    return true;
  }

  return trial.title.toLowerCase().includes(normalizedSearch);
}

function matchesFacetSelections(
  trial: TrialSummary,
  filters: {
    status: string;
    phases: string[];
    interventionType: string;
    sponsor: string;
    search: string;
  },
  excludedFacet?: TrialFacetKey,
) {
  if (!matchesTrialSearch(trial, filters.search)) {
    return false;
  }

  if (
    excludedFacet !== "status" &&
    filters.status &&
    (trial.status ?? "").toLowerCase() !== filters.status.toLowerCase()
  ) {
    return false;
  }

  if (
    excludedFacet !== "phase" &&
    filters.phases.length > 0 &&
    !filters.phases.some((phase) => phase.toLowerCase() === (trial.phase ?? "").toLowerCase())
  ) {
    return false;
  }

  if (
    excludedFacet !== "intervention_type" &&
    filters.interventionType &&
    (trial.intervention_type ?? "").toLowerCase() !== filters.interventionType.toLowerCase()
  ) {
    return false;
  }

  if (
    excludedFacet !== "sponsor" &&
    filters.sponsor &&
    !(trial.sponsor ?? "").toLowerCase().includes(filters.sponsor.toLowerCase())
  ) {
    return false;
  }

  return true;
}

function buildFacetOptions(
  trials: TrialSummary[],
  key: TrialFacetKey,
  selectedValue: string,
  labelForValue: (value: string) => string,
) {
  const values = uniqueOptions(trials, key);
  const normalizedSelectedValue = selectedValue.toLowerCase();
  const selectedMissing =
    selectedValue &&
    !values.some((value) => value.toLowerCase() === normalizedSelectedValue);
  const orderedValues = selectedMissing ? [selectedValue, ...values] : values;

  return [
    { label: "All", value: "" },
    ...orderedValues.map((value) => ({
      label: labelForValue(value),
      value,
    })),
  ];
}

function buildMultiSelectFacetOptions(
  trials: TrialSummary[],
  key: TrialFacetKey,
  selectedValues: string[],
  labelForValue: (value: string) => string,
) {
  const values = uniqueOptions(trials, key);
  const seen = new Set(values.map((value) => value.toLowerCase()));
  const orderedValues = [...selectedValues, ...values].filter((value) => {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      seen.delete(normalized);
      return true;
    }
    return !values.some((existing) => existing.toLowerCase() === normalized);
  });

  return orderedValues.map((value) => ({
    label: labelForValue(value),
    value,
  }));
}

type DashboardViewProps = {
  onOpenTrialSnapshot: (trialId: string) => void;
};

export function DashboardView({ onOpenTrialSnapshot }: DashboardViewProps) {
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState<string[]>([]);
  const [interventionType, setInterventionType] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const normalizedSearch = search.trim();
  const trialQueryParams = useMemo(
    () => ({
      envelope: "true" as const,
      limit: 100,
      status: status || undefined,
      phases: phase.length ? phase : undefined,
      intervention_type: interventionType || undefined,
      sponsor: sponsor || undefined,
      q: normalizedSearch || undefined,
    }),
    [status, phase, interventionType, sponsor, normalizedSearch],
  );

  const trialsQuery = useInfiniteQuery({
    queryKey: ["trials", "cursor", trialQueryParams],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listTrialsPage({
        ...trialQueryParams,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    ...catalogQueryOptions,
  });

  const unfilteredTrialsQuery = useQuery({
    queryKey: ["trials", "total"],
    queryFn: () => listTrialsPage({ envelope: "true", limit: 1 }),
    ...catalogQueryOptions,
  });

  const allTrials = trialsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const trialTotal = trialsQuery.data?.pages[0]?.total ?? allTrials.length;
  const unfilteredTrialTotal = unfilteredTrialsQuery.data?.total ?? trialTotal;
  const activeFilters = {
    status,
    phases: phase,
    interventionType,
    sponsor,
    search: normalizedSearch.toLowerCase(),
  };
  const trials = allTrials;

  const statusOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "status"),
    ),
    "status",
    status,
    formatStatusLabel,
  );
  const phaseOptions = buildMultiSelectFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "phase"),
    ),
    "phase",
    phase,
    formatPhaseLabel,
  );
  const interventionTypeOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "intervention_type"),
    ),
    "intervention_type",
    interventionType,
    formatInterventionTypeLabel,
  );
  const sponsorOptions = buildFacetOptions(
    allTrials.filter((trial) =>
      matchesFacetSelections(trial, activeFilters, "sponsor"),
    ),
    "sponsor",
    sponsor,
    (value) => value,
  );
  const hasActiveFilters = Boolean(
    status || phase.length || interventionType || sponsor || search.trim(),
  );
  const showTrialSkeletons = trialsQuery.isPending;
  const clearFilters = () => {
    setStatus("");
    setPhase([]);
    setInterventionType("");
    setSponsor("");
    setSearch("");
  };
  const togglePhase = (phaseValue: string) => {
    setPhase((current) =>
      current.some((value) => value.toLowerCase() === phaseValue.toLowerCase())
        ? current.filter((value) => value.toLowerCase() !== phaseValue.toLowerCase())
        : [...current, phaseValue],
    );
  };

  const filterBar = (
    <FilterBar
      groups={[
        {
          label: "Status",
          value: status,
          onSelect: setStatus,
          options: statusOptions,
        },
        {
          label: "Phase",
          selectionMode: "multiple",
          selectedValues: phase,
          onToggle: togglePhase,
          options: phaseOptions,
        },
        {
          label: "Type",
          value: interventionType,
          onSelect: setInterventionType,
          options: interventionTypeOptions,
        },
        {
          label: "Sponsor",
          value: sponsor,
          onSelect: setSponsor,
          options: sponsorOptions,
        },
      ]}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search trial titles"
      onClearAll={hasActiveFilters ? clearFilters : undefined}
      sticky={false}
    />
  );

  const timelineToggle = (
    <div className="inline-flex rounded-full border border-line bg-glass p-1 backdrop-blur-2xl">
      <button
        type="button"
        onClick={() =>
          setViewMode((current) => (current === "timeline" ? "grid" : "timeline"))
        }
        className={cn(
          "rounded-full px-5 py-2.5 text-[14px] font-medium transition",
          viewMode === "timeline" ? "bg-[rgba(232,163,61,0.14)] text-text" : "text-muted",
        )}
        aria-pressed={viewMode === "timeline"}
        aria-label={
          viewMode === "timeline"
            ? "Timeline view active. Activate to return to grid view."
            : "Activate to switch to timeline view."
        }
      >
        Timeline
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 pt-28 md:space-y-12 md:pt-32">
      <header className="space-y-2">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          {hasActiveFilters
            ? `Showing ${trialTotal} of ${unfilteredTrialTotal} trials`
            : `${trialTotal} trials tracked`}
        </h1>
      </header>

      <div className="space-y-4">
        <div className="glass-nav flex flex-col gap-3 rounded-[24px] px-4 py-4 md:flex-row md:items-start md:justify-between">
          {filterBar}
          <div className="relative z-10 flex items-center justify-start md:pt-4">
            {timelineToggle}
          </div>
        </div>

        <div className="space-y-4">
          {trialsQuery.isError ? (
            <div className="rounded-card border border-line bg-panel p-6 text-[15px] text-muted">
              <p>Trials could not be loaded.</p>
              <button
                type="button"
                className="focus-ring mt-4 rounded-full border border-line px-4 py-2 text-[14px] text-text"
                onClick={() => void trialsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {showTrialSkeletons ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <TrialCardSkeleton key={`trial-skeleton-${index}`} />
              ))}
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {trials.map((trial) => (
                  <TrialCard
                    key={trial.id}
                    trial={trial}
                    query={normalizedSearch}
                    onOpen={onOpenTrialSnapshot}
                  />
                ))}
              </div>
              {!trials.length ? (
                <div className="rounded-card border border-line bg-panel px-6 py-12 text-[15px] text-muted">
                  No trials matched this filter.
                </div>
              ) : null}
              {trialsQuery.hasNextPage ? (
                <button
                  type="button"
                  className="focus-ring rounded-full border border-line px-5 py-2.5 text-[14px] text-text"
                  disabled={trialsQuery.isFetchingNextPage}
                  onClick={() => void trialsQuery.fetchNextPage()}
                >
                  {trialsQuery.isFetchingNextPage ? "Loading more trials…" : "Load more trials"}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="pt-4">
              <Timeline
                trials={trials}
                axisTrials={allTrials}
                onOpen={onOpenTrialSnapshot}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
