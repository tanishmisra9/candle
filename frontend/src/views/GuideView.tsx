/**
 * Guide (`/guide`): what choroideremia is and how to read a trial's phase and status, kept short.
 * Labels come from the same formatters as the Trials page, and statuses are grouped by the badge's own
 * marker tier (`statusTier`) and drawn with the same `StatusMarker`, so the legend can never drift from
 * the trial cards. Disease background is cited to MedlinePlus Genetics; no participant numbers are
 * given (sources differ).
 */
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { BackHomeButton } from "../components/BackHomeButton";
import { StatusMarker, statusTier } from "../components/StatusBadge";
import { formatPhaseLabel, formatStatusLabel } from "../lib/formatters";
import { linkButtonClass } from "../lib/ui";

// Phases as a progression: the stepper shows how far along testing is (1, 2 or 3 of 3).
const PHASES = [
  { value: "PHASE1", step: 1, title: "Safety and dose", body: "A small group." },
  { value: "PHASE2", step: 2, title: "Does it seem to work?", body: "A larger group, with safety still checked." },
  { value: "PHASE3", step: 3, title: "How does it compare?", body: "A large group, often against current standard care." },
] as const;

const STATUSES = [
  { value: "RECRUITING", meaning: "Enrolling participants now." },
  { value: "NOT_YET_RECRUITING", meaning: "Planned, but not enrolling yet." },
  { value: "ENROLLING_BY_INVITATION", meaning: "Enrolling only people the study team invites." },
  { value: "ACTIVE_NOT_RECRUITING", meaning: "Under way, and no longer enrolling new participants." },
  { value: "COMPLETED", meaning: "Finished." },
  { value: "TERMINATED", meaning: "Stopped early." },
  { value: "SUSPENDED", meaning: "Paused. It may restart." },
  { value: "WITHDRAWN", meaning: "Cancelled before any participants enrolled." },
];

// Group titles describe what is true of every status in the group (not the badge tier's internal name).
const STATUS_GROUPS = [
  { tier: "active", title: "Planned or under way" },
  { tier: "completed", title: "Finished" },
  { tier: "terminated", title: "Ended early or paused" },
] as const;

// Vertical hairline between columns from `sm`/`md` up; stacked (no rule) on phones. Padding on BOTH sides of
// every rule (pr on all but the last column, pl on all but the first): with only pl, a line that exactly
// filled a column ended against the next column's hairline.
const columnRule = (bp: "sm" | "md") =>
  bp === "sm"
    ? "sm:border-l sm:border-line sm:px-6 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0"
    : "md:border-l md:border-line md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0";

// inline-block (not flex) so a wrapped link keeps its arrow next to the last word; py-3 keeps the 44px target.
const sourceLink =
  "inline-block py-3 text-[0.9375rem] font-medium text-accent underline underline-offset-4 hover:text-text";
const arrow = "ml-1 inline-block -translate-y-px align-baseline";

const H2 = "text-[1.5rem] font-semibold leading-snug tracking-tight";

export function GuideView() {
  return (
    // One column at the full shell width (the same 1280px as the nav and the Trials page, so the left edge
    // lines up with the logo and the grids below use the room). Only the running prose is capped, to a
    // readable line length.
    <div className="pt-28 md:pt-32">
      <BackHomeButton />
      <h1 className="mt-6 text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        How to read a CHM trial
      </h1>
      <p className="mt-4 max-w-[40rem] text-balance text-[1.125rem] leading-[1.6] text-muted">
        What the condition is, and what a trial&rsquo;s phase and status tell you.
      </p>

      <section aria-labelledby="chm-heading" className="mt-16">
        <h2 id="chm-heading" className={H2}>
          What is choroideremia?
        </h2>
        <p className="mt-3 max-w-[46rem] text-[1.125rem] leading-[1.7]">
          Choroideremia (CHM) is an inherited eye condition that causes progressive vision loss and
          mostly affects males. Night blindness is usually the first sign, and the field of vision
          narrows over time. It is caused by changes in the CHM gene.
        </p>
        <a
          href="https://medlineplus.gov/genetics/condition/choroideremia/"
          target="_blank"
          rel="noreferrer"
          className={sourceLink}
        >
          Source: MedlinePlus Genetics
          <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" className={arrow} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </section>

      <section aria-labelledby="phase-heading" className="mt-16">
        <h2 id="phase-heading" className={H2}>
          What a trial&rsquo;s phase means
        </h2>
        <p className="mt-3 max-w-[46rem] text-[1.125rem] leading-[1.7]">
          A phase is a stage of testing, not a sign that the treatment works.
        </p>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-0">
          {PHASES.map(({ value, step, title, body }) => (
            <li key={value} className={columnRule("sm")}>
              <div aria-hidden="true" className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={clsx("h-1 w-8", n <= step ? "bg-accent" : "bg-line-strong")} />
                ))}
              </div>
              <h3 className="mt-4 text-[1.0625rem] font-semibold">{formatPhaseLabel(value)}</h3>
              <p className="mt-1 text-[1rem] font-medium">{title}</p>
              <p className="mt-1 text-[1rem] leading-[1.6] text-muted">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-[46rem] text-[0.9375rem] leading-[1.6] text-muted">
          <span className="font-medium text-text">{formatPhaseLabel("NA")}</span> means no phase
          applies, for example when a study is not testing a drug.
        </p>
      </section>

      <section aria-labelledby="status-heading" className="mt-16">
        <h2 id="status-heading" className={H2}>
          What a trial&rsquo;s status means
        </h2>
        <div className="mt-8 grid gap-10 md:grid-cols-3 md:gap-0">
          {STATUS_GROUPS.map(({ tier, title }) => (
            <div key={tier} className={columnRule("md")}>
              <h3 className="flex items-center gap-2.5 text-[1.0625rem] font-semibold">
                <StatusMarker tier={tier} className="h-2.5 w-2.5" />
                {title}
              </h3>
              <dl className="mt-4 space-y-4">
                {STATUSES.filter(({ value }) => statusTier(value) === tier).map(({ value, meaning }) => (
                  <div key={value}>
                    <dt className="text-[1rem] font-medium">{formatStatusLabel(value)}</dt>
                    <dd className="mt-0.5 text-[1rem] leading-[1.6] text-muted">{meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-[46rem] text-[0.9375rem] leading-[1.6] text-muted">
          A trial&rsquo;s status can change, so always confirm it on the trial&rsquo;s
          ClinicalTrials.gov record, which every trial here links to.
        </p>
        <a
          href="https://www.nei.nih.gov/research/clinical-trials/learn-about-clinical-trials"
          target="_blank"
          rel="noreferrer"
          className={sourceLink}
        >
          Learn about clinical trials (National{" "}
          <span className="whitespace-nowrap">
            Eye Institute)
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" className={arrow} />
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </section>

      <p className="mt-12">
        <Link to="/trials" className={linkButtonClass("primary")}>
          Browse clinical trials
        </Link>
      </p>
    </div>
  );
}
