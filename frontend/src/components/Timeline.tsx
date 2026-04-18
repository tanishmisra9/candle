import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import type { TrialSummary } from "../types";

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
  const rowHeight = 44;
  const leftPadding = 352;
  const labelColumnWidth = 316;
  const yearSpacing = 52;
  const width = Math.max(1120, leftPadding + span * yearSpacing + 120);
  const usableWidth = width - leftPadding - 28;
  const topPadding = 56;
  const chartHeight = Math.max(280, trials.length * rowHeight + topPadding + 42);

  useEffect(() => {
    if (!scrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollLeft = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [width, chartHeight]);

  return (
    <div className="rounded-card border border-line bg-panel shadow-panel">
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
                  className="flex h-[44px] w-full items-center rounded-[12px] px-3 text-left text-[13px] text-text transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F5E0B6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]"
                  title={trial.title}
                >
                  <span className="block truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-x-auto px-7 pb-7 pt-9">
          <motion.svg
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.24 }}
            viewBox={`0 0 ${width} ${chartHeight}`}
            className="block"
            style={{ minWidth: `${width}px`, width: `${width}px` }}
            role="img"
            aria-label="Trial timeline"
          >
            {Array.from({ length: span + 1 }, (_, index) => {
              const year = startYear + index;
              const x = leftPadding + (usableWidth * index) / span;
              const isCurrentYear = year === currentYear;
              return (
                <g key={year}>
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
                        : "hidden"
                    }
                  >
                    {isCurrentYear ? year : ""}
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
                    height={18}
                    rx={9}
                    fill={colorForStatus(trial.status)}
                    opacity={0.92}
                  >
                    <title>{`${trial.id}: ${trial.title}`}</title>
                  </rect>
                </motion.g>
              );
            })}
          </motion.svg>
        </div>
      </div>
    </div>
  );
}
