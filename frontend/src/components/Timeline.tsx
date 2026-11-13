import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { formatStatusLabel } from "../lib/formatters";
import { useIsMobile } from "../lib/mobile";
import type { TrialSummary } from "../types";
import { Tooltip } from "./ui/Tooltip";

// Colour is never the only cue (WCAG 1.4.1): each status also has its own marker shape, shown in
// the legend and next to every trial label.
const TIMELINE_STATUS_LEGEND = [
  { key: "recruiting", label: "Recruiting", marker: "" },
  { key: "active", label: "Active", marker: "!border-2 !bg-transparent" },
  { key: "terminated", label: "Terminated / withdrawn", marker: "rotate-45" },
  { key: "other", label: "Other / unknown", marker: "!border-2 !border-dashed !bg-transparent" },
] as const;

type StatusKey = (typeof TIMELINE_STATUS_LEGEND)[number]["key"];

function StatusMarker({ status }: { status: StatusKey }) {
  const entry = TIMELINE_STATUS_LEGEND.find((item) => item.key === status)!;
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 ${entry.marker}`}
      style={{
        backgroundColor: `rgb(var(--tl-${status}))`,
        borderColor: `rgb(var(--tl-${status}))`,
      }}
    />
  );
}

function trialAriaLabel(trial: TrialSummary) {
  return `${trial.title} (${trial.id}), status: ${formatStatusLabel(trial.status)}`;
}

function yearFromDate(value: string | null) {
  return value ? Number.parseInt(value.slice(0, 4), 10) : undefined;
}

function statusKey(status: string | null): StatusKey {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("recruit")) return "recruiting";
  if (normalized.includes("active")) return "active";
  if (normalized.includes("terminat") || normalized.includes("withdraw")) return "terminated";
  return "other";
}

function colorForStatus(status: string | null) {
  return `rgb(var(--tl-${statusKey(status)}))`;
}

type TimelineProps = {
  trials: TrialSummary[];
  axisTrials?: TrialSummary[];
  onOpen: (trialId: string) => void;
};

export function Timeline({ trials, axisTrials, onOpen }: TimelineProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentYear = new Date().getFullYear();
  const timelineAxisSource = axisTrials?.length ? axisTrials : trials;
  const years = timelineAxisSource.flatMap((trial) => [
    yearFromDate(trial.start_date),
    yearFromDate(trial.completion_date),
  ]);
  const filteredYears = years.filter((year): year is number => Number.isFinite(year));
  const startYear = Math.min(...filteredYears, new Date().getFullYear());
  const endYear = Math.max(...filteredYears, startYear + 1);
  const span = Math.max(1, endYear - startYear);
  const rowHeight = isMobile ? 52 : 44;
  const leftPadding = isMobile ? 20 : 352;
  const labelColumnWidth = 316;
  const yearSpacing = isMobile ? 66 : 52;
  const width = isMobile
    ? Math.max(560, leftPadding + span * yearSpacing + 152)
    : Math.max(1120, leftPadding + span * yearSpacing + 120);
  const usableWidth = isMobile ? width - leftPadding - 120 : width - leftPadding - 28;
  const topPadding = isMobile ? 50 : 56;
  const chartHeight = Math.max(
    isMobile ? 240 : 280,
    trials.length * rowHeight + topPadding + 42,
  );

  useEffect(() => {
    if (!scrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollLeft = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [width, chartHeight]);

  const statusLegend = (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-2 px-4 pt-4 text-[12px] text-muted md:px-7"
      aria-label="Trial status legend"
    >
      {TIMELINE_STATUS_LEGEND.map((entry) => (
        <li key={entry.key} className="inline-flex items-center gap-2">
          <StatusMarker status={entry.key} />
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );

  if (isMobile) {
    return (
      <div className="rounded-panel border border-line bg-panel">
        {statusLegend}
        <div ref={scrollRef} className="overflow-x-auto px-4 pb-5 pt-3">
          <div
            className="relative"
            style={{ minWidth: `${width}px`, width: `${width}px`, height: `${chartHeight}px` }}
          >
            <motion.svg
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1 }}
              transition={{ duration: 0.24 }}
              viewBox={`0 0 ${width} ${chartHeight}`}
              className="absolute inset-0 block"
              style={{ width: `${width}px`, height: `${chartHeight}px` }}
              role="img"
              aria-label="Trial timeline"
            >
              {Array.from({ length: span + 1 }, (_, index) => {
                const year = startYear + index;
                const x = leftPadding + (usableWidth * index) / span;
                const isCurrentYear = year === currentYear;

                return (
                  <g key={year}>
                    {isCurrentYear ? (
                      <rect
                        x={x - 18}
                        y={4}
                        width={36}
                        height={22}
                        rx={2}
                        className="fill-accent/[0.14] stroke-accent/[0.5]"
                      />
                    ) : null}
                    <text
                      x={x}
                      y={19}
                      textAnchor="middle"
                      className={
                        isCurrentYear
                          ? "fill-accent text-[12px]"
                          : "fill-muted text-[12px]"
                      }
                    >
                      {year}
                    </text>
                    <line
                      x1={x}
                      x2={x}
                      y1={topPadding - 6}
                      y2={chartHeight - 14}
                      className={isCurrentYear ? "stroke-accent/[0.4]" : "stroke-line"}
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
              {trials.map((_, index) => {
                const y = topPadding + index * rowHeight + 17;
                return (
                  <line
                    key={`mobile-row-${index}`}
                    x1={leftPadding}
                    x2={width - 16}
                    y1={y}
                    y2={y}
                    className="stroke-line"
                    strokeWidth="1"
                  />
                );
              })}
            </motion.svg>

            {trials.map((trial, index) => {
              const start = yearFromDate(trial.start_date) ?? startYear;
              const end = yearFromDate(trial.completion_date) ?? start;
              const x = leftPadding + ((start - startYear) / span) * usableWidth;
              const barWidth = Math.max(
                104,
                ((Math.max(start, end) - start + 0.45) / span) * usableWidth,
              );
              const y = topPadding + index * rowHeight;
              const label =
                trial.title.length > 44 ? `${trial.title.slice(0, 44)}…` : trial.title;

              return (
                <motion.button
                  key={trial.id}
                  type="button"
                  onClick={() => onOpen(trial.id)}
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          delay: index * 0.025,
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                  className="absolute flex min-h-11 items-center gap-2 overflow-hidden rounded-panel px-3 text-left"
                  style={{
                    left: `${x}px`,
                    top: `${y - 8}px`,
                    width: `${barWidth}px`,
                    backgroundColor: colorForStatus(trial.status),
                    color: "rgb(var(--tl-text))",
                  }}
                  aria-label={trialAriaLabel(trial)}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 border border-current"
                  />
                  <span className="block w-full truncate text-[12px] font-medium">
                    {label}
                    <span className="sr-only">, {formatStatusLabel(trial.status)}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-line bg-panel">
      {statusLegend}
      <div className="grid overflow-hidden" style={{ gridTemplateColumns: `${labelColumnWidth}px minmax(0,1fr)` }}>
        <div className="border-r border-line px-5 pb-7 pt-9">
          <div
            className="space-y-0"
            style={{ height: `${chartHeight}px`, paddingTop: `${topPadding - 8}px` }}
          >
            {trials.map((trial, index) => {
              const label =
                trial.title.length > 42 ? `${trial.title.slice(0, 42)}…` : trial.title;

              return (
                <Tooltip
                  key={trial.id}
                  label={`${trial.title} — ${formatStatusLabel(trial.status)}`}
                  describe={false}
                  className="flex w-full"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(trial.id)}
                    aria-label={trialAriaLabel(trial)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-panel px-3 text-left text-[13px] text-text transition-colors hover:bg-text/[0.06] hover:text-accent"
                  >
                    <StatusMarker status={statusKey(trial.status)} />
                    <span className="block truncate">{label}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Focusable so keyboard users can scroll the chart with the arrow keys (WCAG 2.1.1). */}
        <div
          ref={scrollRef}
          role="region"
          aria-label="Trial timeline chart, scrolls horizontally"
          tabIndex={0}
          className="relative overflow-x-auto px-7 pb-7 pt-9"
        >
          <motion.svg
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.24 }}
            viewBox={`0 0 ${width} ${chartHeight}`}
            className="pointer-events-none block"
            style={{ minWidth: `${width}px`, width: `${width}px`, height: `${chartHeight}px` }}
            aria-hidden="true"
          >
            {Array.from({ length: span + 1 }, (_, index) => {
              const year = startYear + index;
              const x = leftPadding + (usableWidth * index) / span;
              const isCurrentYear = year === currentYear;
              return (
                <g key={year}>
                  {isCurrentYear ? (
                    <rect
                      x={x - 18}
                      y={2}
                      width={36}
                      height={22}
                      rx={2}
                      className="fill-accent/[0.14] stroke-accent/[0.5]"
                    />
                  ) : null}
                  <text
                    x={x}
                    y={18}
                    textAnchor="middle"
                    className={
                      isCurrentYear
                        ? "fill-accent text-[12px]"
                        : "fill-muted text-[12px]"
                    }
                  >
                    {year}
                  </text>
                  <line
                    x1={x}
                    x2={x}
                    y1={topPadding - 6}
                    y2={trials.length * rowHeight + topPadding + 6}
                    className={isCurrentYear ? "stroke-accent/[0.4]" : "stroke-line"}
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {trials.map((trial, index) => {
              const start = yearFromDate(trial.start_date) ?? startYear;
              const end = yearFromDate(trial.completion_date) ?? start;
              const x = leftPadding + ((start - startYear) / span) * usableWidth;
              const barWidth = Math.max(
                10,
                ((Math.max(start, end) - start + 0.35) / span) * usableWidth,
              );
              const y = topPadding + index * rowHeight;

              return (
                <motion.g
                  key={trial.id}
                  initial={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: 0, y: -10 }
                  }
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: 1, y: 0 }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          delay: index * 0.025,
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <rect
                    x={x}
                    y={y - 5}
                    width={barWidth}
                    height={24}
                    rx={2}
                    fill={colorForStatus(trial.status)}
                  />
                </motion.g>
              );
            })}
          </motion.svg>

          {trials.map((trial, index) => {
            const start = yearFromDate(trial.start_date) ?? startYear;
            const end = yearFromDate(trial.completion_date) ?? start;
            const x = leftPadding + ((start - startYear) / span) * usableWidth;
            const barWidth = Math.max(
              10,
              ((Math.max(start, end) - start + 0.35) / span) * usableWidth,
            );
            const y = topPadding + index * rowHeight;

            return (
              // Pointer-only duplicate of the row button in the left column (same action, 44px
              // target, keyboard + screen reader accessible), so it stays out of tab order and the
              // accessibility tree instead of doubling every trial.
              <button
                key={`bar-${trial.id}`}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => onOpen(trial.id)}
                className="absolute min-h-6 rounded-panel transition-opacity hover:opacity-80"
                style={{
                  left: `${x}px`,
                  top: `${y - 8}px`,
                  width: `${Math.max(barWidth, 24)}px`,
                  height: "24px",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
