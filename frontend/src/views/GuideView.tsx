/**
 * Guide (`/guide`): what choroideremia is and how to read a trial's phase and status. Labels come from
 * the same formatters and badge components as the Trials page, at the same size, so the two never
 * disagree. Statuses are grouped by the badge's own marker tier (`statusTier`), which makes the marker
 * shapes a legend. Disease background is cited to MedlinePlus Genetics; no participant numbers are
 * given (sources differ).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PhasePill } from "../components/PhasePill";
import { StatusBadge, statusTier } from "../components/StatusBadge";
import { linkButtonClass } from "../lib/ui";

type Entry = { value: string; meaning: string };

const PHASES: Entry[] = [
  { value: "PHASE1", meaning: "Early testing in a small group, mainly to check safety and find a suitable dose." },
  { value: "PHASE2", meaning: "Testing in a larger group to see whether the treatment seems to work, while still checking safety." },
  { value: "PHASE3", meaning: "Testing in a large group, often comparing the treatment with current standard care." },
  { value: "NA", meaning: "No phase applies, for example when a study is not testing a drug." },
];

const STATUSES: Entry[] = [
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

const externalLink =
  "inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text";

function Rows({ items, label }: { items: Entry[]; label: (value: string) => ReactNode }) {
  return (
    <dl>
      {items.map(({ value, meaning }) => (
        <div
          key={value}
          className="grid items-start gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[15rem_1fr] sm:gap-6"
        >
          <dt>{label(value)}</dt>
          <dd className="text-[1rem] leading-[1.65]">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

// Chips fill the label column from `sm` up so the labels read as one aligned column.
const CHIP = "sm:w-full";

export function GuideView() {
  return (
    <div className="mx-auto max-w-[40rem] pt-28 md:pt-32">
      <h1 className="text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        A short guide to CHM and clinical trials
      </h1>

      <section aria-labelledby="chm-heading" className="mt-10">
        <h2 id="chm-heading" className="text-[1.375rem] font-semibold leading-snug">
          What is choroideremia?
        </h2>
        <p className="mt-2 text-[1.125rem] leading-[1.7]">
          Choroideremia (CHM) is an inherited eye condition that causes progressive vision loss and
          mostly affects males. Night blindness is usually the first sign, and the field of vision
          narrows over time. It is caused by changes in the CHM gene.{" "}
          <a
            href="https://medlineplus.gov/genetics/condition/choroideremia/"
            target="_blank"
            rel="noreferrer"
            className={externalLink}
          >
            Source: MedlinePlus Genetics
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>

      <section aria-labelledby="phase-heading" className="mt-12">
        <h2 id="phase-heading" className="text-[1.375rem] font-semibold leading-snug">
          What a trial&rsquo;s phase means
        </h2>
        <p className="mt-2 text-[1.125rem] leading-[1.7]">
          Trials are tested in phases. A phase describes the stage of testing, not whether a
          treatment works.
        </p>
        <div className="mt-4">
          <Rows items={PHASES} label={(value) => <PhasePill phase={value} className={CHIP} />} />
        </div>
      </section>

      <section aria-labelledby="status-heading" className="mt-12">
        <h2 id="status-heading" className="text-[1.375rem] font-semibold leading-snug">
          What a trial&rsquo;s status means
        </h2>
        <p className="mt-2 text-[1.125rem] leading-[1.7]">
          The marker beside each status is the same one shown on every trial card.
        </p>
        {STATUS_GROUPS.map(({ tier, title }) => (
          <div key={tier} className="mt-6">
            <h3 className="kicker border-b border-line-strong pb-2 text-[0.75rem] font-medium text-muted">
              {title}
            </h3>
            <Rows
              items={STATUSES.filter(({ value }) => statusTier(value) === tier)}
              label={(value) => <StatusBadge status={value} className={CHIP} />}
            />
          </div>
        ))}
        <p className="mt-6 text-[1.125rem] leading-[1.7] text-muted">
          A trial&rsquo;s status can change. Always confirm it on the trial&rsquo;s ClinicalTrials.gov
          record, which every trial here links to.{" "}
          <a
            href="https://www.nei.nih.gov/research/clinical-trials/learn-about-clinical-trials"
            target="_blank"
            rel="noreferrer"
            className={externalLink}
          >
            Learn about clinical trials (National Eye Institute)
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>

      <p className="mt-10">
        <Link to="/trials" className={linkButtonClass("primary")}>
          Browse clinical trials
        </Link>
      </p>
    </div>
  );
}
