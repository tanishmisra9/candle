/** Landing page (`/`): a warm welcome, three audience paths, a live status sentence, a short guide, what Candle does and doesn't do, and a note from the builder. Single column, rem-based type, calm stoppable motion (see components/home/FlameLogo.tsx). */
import { Link } from "react-router-dom";

import { FlameLogo, PauseAnimationButton } from "../components/home/FlameLogo";
import { CandleToday } from "../components/home/CandleToday";
import { StartPaths } from "../components/home/StartPaths";
import { TrialGlossary } from "../components/home/TrialGlossary";
import { useCandleMotion } from "../components/home/useCandleMotion";
import { linkButtonClass } from "../lib/ui";

export function HomeView() {
  const motion = useCandleMotion();

  return (
    <div className="mx-auto w-full max-w-[40rem] pb-8 pt-24 md:pt-32">
      <section aria-labelledby="welcome-heading" className="flex flex-col items-center text-center">
        <FlameLogo running={motion.running} />
        <h1
          id="welcome-heading"
          className="mt-6 text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.25rem]"
        >
          Welcome to Candle
        </h1>
        <p className="mt-3 text-[1.375rem] font-medium leading-snug text-muted">
          A small light for a long journey.
        </p>
        <p className="mt-6 text-[1.125rem] leading-[1.7]">
          Candle brings every choroideremia (CHM) clinical trial and research paper together in
          one calm place, explained in plain language and linked to its sources.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/trials" className={linkButtonClass("primary")}>
            Browse clinical trials
          </Link>
          <Link to="/literature" className={linkButtonClass()}>
            Read the research
          </Link>
          <Link to="/ask" className={linkButtonClass()}>
            Ask a question
          </Link>
        </div>
        <div className="mt-4">
          <PauseAnimationButton
            paused={motion.paused}
            reduced={motion.reduced}
            onToggle={motion.togglePaused}
          />
        </div>
        <CandleToday />
      </section>

      <StartPaths />
      <TrialGlossary />

      <section aria-labelledby="limits-heading" className="mt-16 border-t border-line pt-10">
        <h2 id="limits-heading" className="text-[1.75rem] font-semibold leading-tight tracking-tight">
          What Candle does, and what it doesn&rsquo;t
        </h2>
        <ul className="mt-4 list-disc space-y-3 pl-6 text-[1.125rem] leading-[1.7]">
          <li>
            Candle collects trials from ClinicalTrials.gov and papers from PubMed, and links them
            where a paper names a trial.
          </li>
          <li>
            Plain-language summaries and overviews are written by AI. They can contain mistakes,
            so please check the original record.
          </li>
          <li>
            Ask only reports what is documented in those sources, and shows where each answer came
            from.
          </li>
          <li>
            Candle does not give medical advice and cannot tell you which trial is right for you.
            Please talk with your care team about decisions.
          </li>
        </ul>
      </section>

      <section aria-labelledby="note-heading" className="mt-16 border-t border-line pt-10">
        <h2 id="note-heading" className="text-[1.75rem] font-semibold leading-tight tracking-tight">
          A note from the builder
        </h2>
        <p className="mt-4 text-[1.125rem] leading-[1.7]">
          Candle exists because I also live with choroideremia. That changes the shape of the
          work. This is patient-engineering: one place to see the trial landscape clearly, follow
          the literature without noise, and keep a small light on for the long journey.
        </p>
        <p className="mt-2">
          <a
            href="https://curechm.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text"
          >
            Visit the CureCHM patient community
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>
    </div>
  );
}
