/** Trial list card. The whole card is one `<button>`, so nothing inside it may be interactive (no tooltips or links on its badges). Title is an `<h2>` under the page `<h1>`. */
import { memo } from "react";

import { formatParticipants, formatSitesLabel } from "../lib/formatters";
import { highlightText } from "../lib/highlight";
import type { TrialSummary } from "../types";
import { PhasePill } from "./PhasePill";
import { StatusBadge } from "./StatusBadge";

type TrialCardProps = {
  trial: TrialSummary;
  query?: string;
  onOpen: (trialId: string) => void;
};

const MAX_COUNTRIES = 2;

export const TrialCard = memo(function TrialCard({ trial, query = "", onOpen }: TrialCardProps) {
  const meta = [
    trial.sponsor || "Unknown sponsor",
    formatParticipants(trial.enrollment),
    formatSitesLabel(trial.locations, MAX_COUNTRIES),
  ].join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(trial.id)}
      className="group flex h-full flex-col rounded-panel border border-line bg-panel p-7 text-left transition-colors hover:border-accent active:border-accent active:bg-text/[0.04]"
    >
      {/* Status first: "is this open?" is the one fact a visitor scans for, so it leads the card. */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={trial.status} />
        <PhasePill phase={trial.phase} />
      </div>
      <h2 className="mt-5 line-clamp-2 text-[20px] font-medium leading-7 tracking-[-0.015em] text-text">
        {highlightText(trial.title, query)}
      </h2>
      <p className="mt-3.5 line-clamp-2 text-[15px] leading-[1.6] text-muted">
        {trial.intervention || "Intervention details not reported."}
      </p>

      <p className="mt-auto pt-7 text-[13px] leading-[1.5] text-muted tabular-nums">{meta}</p>
    </button>
  );
});
