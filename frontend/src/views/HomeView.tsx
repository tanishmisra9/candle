/** Landing page (`/`): a warm welcome, three audience paths, a live status sentence, a short guide, what Candle does and doesn't do, and a note from the builder. Single column, rem-based type, calm motion (see components/home/FlameLogo.tsx). */
import { useRef } from "react";
import { Link } from "react-router-dom";

import { FlameLogo } from "../components/home/FlameLogo";
import { CandleToday } from "../components/home/CandleToday";
import { StartPaths } from "../components/home/StartPaths";
import { TrialGlossary } from "../components/home/TrialGlossary";
import { useCandleMotion, useScrollGlow } from "../components/home/useCandleMotion";
import { useIgnition } from "../components/home/useIgnition";
import { linkButtonClass } from "../lib/ui";

export function HomeView() {
  const motion = useCandleMotion();
  const { ignite, offscreen, observedRef } = useIgnition(motion.running);
  const glowRef = useRef<HTMLDivElement>(null);
  useScrollGlow(glowRef, motion.running);

  return (
    // data-ignite drives the whole page: the dark stage, the flame, and the content that appears in
    // its light. Gated elements (.reveal) are only made transparent, never removed or hidden.
    <div
      className="candle intro"
      data-candle-motion={motion.running ? "running" : "paused"}
      data-candle-offscreen={offscreen}
      data-ignite={ignite}
    >
      <div ref={glowRef} aria-hidden="true" className="candle-room-glow" />
      <div className="pt-[calc(var(--nav-offset)+1rem)]">
        <section aria-labelledby="welcome-heading" className="night-stage">
          <div className="stage-veil" aria-hidden="true" />
          <div className="stage-content">
            <FlameLogo logoRef={observedRef} />
            <h1
              id="welcome-heading"
              className="reveal reveal-1 mt-8 text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.25rem]"
            >
              Welcome to Candle
            </h1>
            <p className="reveal reveal-2 mt-3 text-[1.375rem] font-medium leading-snug text-muted">
              A small light for a long journey.
            </p>
            <p className="reveal reveal-3 mt-6 max-w-[36rem] text-[1.125rem] leading-[1.7]">
              Candle brings every choroideremia (CHM) clinical trial and research paper together in
              one calm place, explained in plain language and linked to its sources.
            </p>
            <div className="reveal reveal-4 mt-8 flex flex-wrap justify-center gap-3">
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
            <div className="reveal reveal-5">
              <CandleToday />
            </div>
          </div>
        </section>
      </div>

      <div className="reveal reveal-6 mx-auto w-full max-w-[40rem] pb-8">
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
    </div>
  );
}
