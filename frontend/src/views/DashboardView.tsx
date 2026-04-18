import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, ExternalLink, Mail, MapPin, X } from "lucide-react";

import { FilterBar } from "../components/FilterBar";
import { Timeline } from "../components/Timeline";
import { TrialCard } from "../components/TrialCard";
import { Button } from "../components/ui/Button";
import { getTrial, listTrials } from "../lib/api";
import {
  formatInterventionTypeLabel,
  formatPhaseLabel,
  formatStatusLabel,
} from "../lib/formatters";
import type { TrialSummary } from "../types";

type ViewMode = "grid" | "timeline";

function uniqueOptions(trials: TrialSummary[], key: keyof TrialSummary) {
  return Array.from(
    new Set(
      trials
        .map((trial) => trial[key])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

export function DashboardView() {
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("");
  const [interventionType, setInterventionType] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filtersQuery = useQuery({
    queryKey: ["trials", "filters"],
    queryFn: () => listTrials({ limit: 500 }),
  });

  const trialsQuery = useQuery({
    queryKey: [
      "trials",
      status,
      phase,
      interventionType,
      sponsor,
      deferredSearch,
      viewMode,
    ],
    queryFn: () =>
      listTrials({
        status: status || undefined,
        phase: phase || undefined,
        intervention_type: interventionType || undefined,
        sponsor: sponsor || undefined,
        q: deferredSearch || undefined,
        limit: 500,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["trial", selectedTrialId],
    queryFn: () => getTrial(selectedTrialId as string),
    enabled: Boolean(selectedTrialId),
  });

  const filterSource = filtersQuery.data ?? [];
  const trials = trialsQuery.data ?? [];

  const statusOptions = uniqueOptions(filterSource, "status");
  const phaseOptions = uniqueOptions(filterSource, "phase");
  const interventionTypeOptions = uniqueOptions(filterSource, "intervention_type");
  const sponsorOptions = uniqueOptions(filterSource, "sponsor");

  return (
    <div className="space-y-10 pb-16 pt-28">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
          CHM Clinical Trials
        </p>
        <h1 className="text-[32px] font-medium tracking-[-0.02em] text-text">
          {trials.length} trials tracked
        </h1>
        <p className="text-[15px] text-muted">
          Everything currently known, updated weekly.
        </p>
      </header>

      <FilterBar
        groups={[
          {
            label: "Status",
            value: status,
            onSelect: setStatus,
            options: [
              { label: "All", value: "" },
              ...statusOptions.map((option) => ({
                label: formatStatusLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Phase",
            value: phase,
            onSelect: setPhase,
            options: [
              { label: "All", value: "" },
              ...phaseOptions.map((option) => ({
                label: formatPhaseLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Type",
            value: interventionType,
            onSelect: setInterventionType,
            options: [
              { label: "All", value: "" },
              ...interventionTypeOptions.map((option) => ({
                label: formatInterventionTypeLabel(option),
                value: option,
              })),
            ],
          },
          {
            label: "Sponsor",
            value: sponsor,
            onSelect: setSponsor,
            options: [
              { label: "All", value: "" },
              ...sponsorOptions.map((option) => ({ label: option, value: option })),
            ],
          },
        ]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search trial titles"
      />

      <div className="flex items-center justify-end pt-3">
        <div className="inline-flex rounded-full border border-line bg-glass p-1 backdrop-blur-2xl">
          {(["grid", "timeline"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                viewMode === mode
                  ? "bg-[rgba(232,163,61,0.14)] text-text"
                  : "text-muted"
              }`}
            >
              {mode === "grid" ? "Grid" : "Timeline"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {trials.map((trial) => (
              <TrialCard
                key={trial.id}
                trial={trial}
                onOpen={() => setSelectedTrialId(trial.id)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="pt-4"
          >
            <Timeline trials={trials} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTrialId ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-[rgba(11,11,15,0.28)] p-4 backdrop-blur-sm md:items-center md:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTrialId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] border border-line bg-panel p-6 shadow-panel md:max-w-[860px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.18em] text-muted">
                    {detailQuery.data?.id}
                  </p>
                  <h2 className="mt-2 text-[24px] font-medium tracking-[-0.02em] text-text">
                    {detailQuery.data?.title}
                  </h2>
                </div>
                <Button variant="ghost" onClick={() => setSelectedTrialId(null)}>
                  <X size={18} strokeWidth={1.5} />
                </Button>
              </div>

              {detailQuery.isLoading ? (
                <p className="mt-8 text-[14px] text-muted">Loading trial details…</p>
              ) : detailQuery.data ? (
                <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-8">
                    <section className="space-y-3">
                      <h3 className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">
                        Snapshot
                      </h3>
                      <p className="text-[15px] leading-7 text-text">
                        {detailQuery.data.intervention || "Intervention details not reported."}
                      </p>
                      <div className="grid gap-3 text-[14px] text-muted">
                        <div className="inline-flex items-center gap-2">
                          <CalendarRange size={16} strokeWidth={1.5} />
                          {formatDate(detailQuery.data.start_date)} to{" "}
                          {formatDate(detailQuery.data.completion_date)}
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <MapPin size={16} strokeWidth={1.5} />
                          {detailQuery.data.locations.length} locations listed
                        </div>
                        {detailQuery.data.contact_email ? (
                          <div className="inline-flex items-center gap-2">
                            <Mail size={16} strokeWidth={1.5} />
                            {detailQuery.data.contact_email}
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">
                        Outcomes
                      </h3>
                      <div className="space-y-3">
                        {detailQuery.data.outcomes.length ? (
                          detailQuery.data.outcomes.map((outcome, index) => (
                            <div
                              key={`${outcome.outcome_type}-${index}`}
                              className="rounded-[18px] border border-line p-4"
                            >
                              <p className="text-[12px] uppercase tracking-[0.14em] text-muted">
                                {outcome.outcome_type}
                              </p>
                              <p className="mt-2 text-[15px] font-medium text-text">
                                {outcome.measure}
                              </p>
                              {outcome.timeframe ? (
                                <p className="mt-1 text-[13px] text-muted">
                                  {outcome.timeframe}
                                </p>
                              ) : null}
                              {outcome.description ? (
                                <p className="mt-2 text-[14px] leading-6 text-muted">
                                  {outcome.description}
                                </p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-[14px] text-muted">
                            No structured outcomes were available in the upstream record.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">
                        Linked Literature
                      </h3>
                      <a
                        href={detailQuery.data.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] text-muted transition hover:text-text"
                      >
                        ClinicalTrials.gov <ExternalLink size={14} strokeWidth={1.5} />
                      </a>
                    </div>
                    <div className="space-y-3">
                      {detailQuery.data.publications.length ? (
                        detailQuery.data.publications.map((publication) => (
                          <a
                            key={publication.pmid}
                            href={publication.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-[18px] border border-line p-4 transition hover:border-[rgba(232,163,61,0.22)]"
                          >
                            <p className="text-[15px] font-medium leading-6 text-text">
                              {publication.title}
                            </p>
                            <p className="mt-2 text-[13px] text-muted">
                              {publication.authors[0]?.split(",")[0] ?? "Unknown author"} et al.
                              {publication.pub_date ? `, ${publication.pub_date.slice(0, 4)}` : ""}
                            </p>
                          </a>
                        ))
                      ) : (
                        <p className="text-[14px] text-muted">
                          No linked publications yet for this trial.
                        </p>
                      )}
                    </div>
                  </aside>
                </div>
              ) : (
                <p className="mt-8 text-[14px] text-muted">Trial details could not be loaded.</p>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
