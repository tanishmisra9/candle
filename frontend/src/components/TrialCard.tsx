import { memo } from "react";
import { Building2, MapPin, Users } from "lucide-react";

import { highlightText } from "../lib/highlight";
import type { TrialSummary } from "../types";
import { PhasePill } from "./PhasePill";
import { StatusBadge } from "./StatusBadge";

type TrialCardProps = {
  trial: TrialSummary;
  query?: string;
  onOpen: (trialId: string) => void;
};

export const TrialCard = memo(function TrialCard({ trial, query = "", onOpen }: TrialCardProps) {
  const enrollmentLabel =
    trial.enrollment === null ? "Participant count unavailable" : `${trial.enrollment} participants`;
  const locationCount = trial.locations.length;
  const locationLabel = `${locationCount} site${locationCount === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(trial.id)}
      className="focus-ring group flex h-full flex-col rounded-card border border-line bg-panel p-7 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-[rgba(232,163,61,0.22)] hover:shadow-panel-hover"
    >
      <h3 className="line-clamp-2 text-[20px] font-medium leading-7 tracking-[-0.015em] text-text">
        {highlightText(trial.title, query)}
      </h3>
      <p className="mt-3.5 line-clamp-2 text-[15px] leading-[1.6] text-muted">
        {trial.intervention || "Intervention details not reported."}
      </p>

      <div className="mt-auto flex flex-wrap gap-3.5 pt-7 text-[13px] text-muted tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={15} strokeWidth={1.5} />
          {trial.sponsor || "Unknown sponsor"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} strokeWidth={1.5} aria-hidden="true" />
          <span aria-hidden="true">{trial.enrollment ?? "—"}</span>
          <span className="sr-only">{enrollmentLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} strokeWidth={1.5} aria-hidden="true" />
          <span aria-hidden="true">{locationCount}</span>
          <span className="sr-only">{locationLabel}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={trial.status} />
        <PhasePill phase={trial.phase} />
      </div>
    </button>
  );
});
