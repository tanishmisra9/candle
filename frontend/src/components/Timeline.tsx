import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { formatStatusLabel } from "../lib/formatters";
import { useIsMobile } from "../lib/mobile";
import type { TrialSummary } from "../types";

const TIMELINE_STATUS_LEGEND = [
  { key: "recruiting", label: "Recruiting", color: "#8AB6A8" },
  { key: "active", label: "Active", color: "#86A8C8" },
  { key: "terminated", label: "Terminated / withdrawn", color: "#C18A8A" },
  { key: "other", label: "Other / unknown", color: "#B6B2AC" },
] as const;

function trialAriaLabel(trial: TrialSummary) {
  return `${trial.title} (${trial.id}), status: ${formatStatusLabel(trial.status)}`;
}

function yearFromDate(value: string | null) {
  return value ? Number.parseInt(value.slice(0, 4), 10) : undefined;
}

function colorForStatus(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("recruit")) return "#8AB6A8";
  if (normalized.includes("active")) return "#86A8C8";
  if (normalized.includes("terminat") || normalized.includes("withdraw")) return "#C18A8A";
  return "#B6B2AC";
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
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );

  if (isMobile) {
    return (
      <div className="rounded-card border border-line bg-panel shadow-panel">
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
                        rx={10}
                        fill="rgba(232, 163, 61, 0.14)"
                        stroke="rgba(232, 163, 61, 0.24)"
                      />
                    ) : null}
                    <text
                      x={x}
                      y={19}
                      textAnchor="middle"
                      className={
                        isCurrentYear
                          ? "fill-[#F5E0B6] text-[12px]"
                          : "fill-[var(--muted-text)] text-[12px]"
                      }
                    >
                      {year}
                    </text>
                    <line
                      x1={x}
                      x2={x}
                      y1={topPadding - 6}
                      y2={chartHeight - 14}
                      stroke={
                        isCurrentYear ? "rgba(232, 163, 61, 0.18)" : "var(--hairline)"
                      }
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
                    stroke="rgba(255,255,255,0.03)"
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
                  className="absolute flex min-h-9 items-center overflow-hidden rounded-full px-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]"
                  style={{
                    left: `${x}px`,
                    top: `${y - 8}px`,
                    width: `${barWidth}px`,
                    backgroundColor: colorForStatus(trial.status),
                    opacity: 0.96,
                  }}
                  aria-label={trialAriaLabel(trial)}
                  title={`${trial.title} — ${formatStatusLabel(trial.status)}`}
                >
                  <span className="block w-full truncate text-[12px] font-medium text-[rgba(11,11,15,0.86)]">
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
    <div className="rounded-card border border-line bg-panel shadow-panel">
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
                <button
                  key={trial.id}
                  type="button"
                  onClick={() => onOpen(trial.id)}
                  aria-label={trialAriaLabel(trial)}
                  className="focus-ring flex min-h-11 w-full items-center rounded-[12px] px-3 text-left text-[13px] text-text transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F5E0B6]"
                  title={`${trial.title} — ${formatStatusLabel(trial.status)}`}
                >
                  <span className="block truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="relative overflow-x-auto px-7 pb-7 pt-9"
          style={{ minWidth: `${width}px` }}
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
                      rx={10}
                      fill="rgba(232, 163, 61, 0.14)"
                      stroke="rgba(232, 163, 61, 0.24)"
                    />
                  ) : null}
                  <text
                    x={x}
                    y={18}
                    textAnchor="middle"
                    className={
                      isCurrentYear
                        ? "fill-[#F5E0B6] text-[12px]"
                        : "fill-[var(--muted-text)] text-[12px]"
                    }
                  >
                    {year}
                  </text>
                  <line
                    x1={x}
                    x2={x}
                    y1={topPadding - 6}
                    y2={trials.length * rowHeight + topPadding + 6}
                    stroke={
                      isCurrentYear
                        ? "rgba(232, 163, 61, 0.18)"
                        : "var(--hairline)"
                    }
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
                    rx={12}
                    fill={colorForStatus(trial.status)}
                    opacity={0.92}
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
              <button
                key={`bar-${trial.id}`}
                type="button"
                onClick={() => onOpen(trial.id)}
                aria-label={trialAriaLabel(trial)}
                className="focus-ring absolute min-h-6 rounded-full transition hover:brightness-110"
                style={{
                  left: `${x}px`,
                  top: `${y - 8}px`,
                  width: `${Math.max(barWidth, 24)}px`,
                  height: "24px",
                }}
                title={`${trial.title} — ${formatStatusLabel(trial.status)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
