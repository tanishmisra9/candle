/**
 * A short guide to CHM and to reading a trial. Labels come from the same formatters and badge
 * components as the Trials page so the two never disagree. Disease background is cited to
 * MedlinePlus Genetics; no participant numbers are given (sources differ).
 */
import { PhasePill } from "../PhasePill";
import { StatusBadge } from "../StatusBadge";

// The Trials page keeps these labels compact (11px); on this page they are the thing being
// explained, so they are bumped for readability. `!` because the badges set their own size.
const BIG_BADGE = "!px-3 !py-2 !text-[0.9375rem]";

const PHASES: Array<{ value: string; meaning: string }> = [
  { value: "PHASE1", meaning: "Early testing in a small group, mainly to check safety and find a suitable dose." },
  { value: "PHASE2", meaning: "Testing in a larger group to see whether the treatment seems to work, while still checking safety." },
  { value: "PHASE3", meaning: "Testing in a large group, often comparing the treatment with current standard care." },
  { value: "NA", meaning: "No phase applies, for example when a study is not testing a drug." },
];

const STATUSES: Array<{ value: string; meaning: string }> = [
  { value: "RECRUITING", meaning: "Enrolling participants now." },
  { value: "NOT_YET_RECRUITING", meaning: "Planned, but not enrolling yet." },
  { value: "ENROLLING_BY_INVITATION", meaning: "Enrolling only people the study team invites." },
  { value: "ACTIVE_NOT_RECRUITING", meaning: "Under way, and no longer enrolling new participants." },
  { value: "COMPLETED", meaning: "Finished." },
  { value: "TERMINATED", meaning: "Stopped early." },
  { value: "SUSPENDED", meaning: "Paused. It may restart." },
  { value: "WITHDRAWN", meaning: "Cancelled before any participants enrolled." },
];

const externalLink =
  "inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text";

function Definitions({ items, term }: { items: typeof PHASES; term: (value: string) => React.ReactNode }) {
  return (
    <dl className="mt-4">
      {items.map(({ value, meaning }) => (
        <div
          key={value}
          className="grid gap-1 border-t border-line py-4 first:border-t-0 sm:grid-cols-[14rem_1fr] sm:gap-6"
        >
          <dt>{term(value)}</dt>
          <dd className="text-[1.125rem] leading-[1.7]">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TrialGlossary() {
  return (
    <section
      id="how-to-read-a-trial"
      aria-labelledby="guide-heading"
      className="mt-16 scroll-mt-[calc(var(--nav-offset)+1rem)] border-t border-line pt-10"
    >
      <h2 id="guide-heading" className="text-[1.75rem] font-semibold leading-tight tracking-tight">
        A short guide to CHM and clinical trials
      </h2>

      <h3 className="mt-6 text-[1.25rem] font-semibold leading-snug">What is choroideremia?</h3>
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

      <h3 className="mt-8 text-[1.25rem] font-semibold leading-snug">What a trial&rsquo;s phase means</h3>
      <p className="mt-2 text-[1.125rem] leading-[1.7]">
        Trials are tested in phases. A phase describes the stage of testing, not whether a
        treatment works.
      </p>
      <Definitions items={PHASES} term={(value) => <PhasePill phase={value} className={BIG_BADGE} />} />

      <h3 className="mt-8 text-[1.25rem] font-semibold leading-snug">What a trial&rsquo;s status means</h3>
      <Definitions items={STATUSES} term={(value) => <StatusBadge status={value} className={BIG_BADGE} />} />

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
  );
}
