/** Landing page (`/`): one screen. The flame, a welcome, the three main destinations and a live status sentence. The guide, the limits and the builder note live on /guide and /about (linked from the footer). Rem-based type, calm motion (see components/home/FlameLogo.tsx). */
import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { FlameLogo } from "../components/home/FlameLogo";
import { CandleToday } from "../components/home/CandleToday";
import { useCandleMotion, useScrollGlow } from "../components/home/useCandleMotion";
import { useIgnition } from "../components/home/useIgnition";
import { linkButtonClass } from "../lib/ui";

// Full width on phones (a single column of three), natural width in a row from `sm` up.
const FULL = "w-full sm:w-auto";

export function HomeView() {
  const motion = useCandleMotion();
  const { ignite, offscreen, observedRef } = useIgnition(motion.running);
  const glowRef = useRef<HTMLDivElement>(null);
  useScrollGlow(glowRef, motion.running);

  // The dusk veil is drawn by html::before (index.html starts it before first paint), so mirror the
  // ignition state onto <html>, and clear it when leaving the page.
  useLayoutEffect(() => {
    document.documentElement.dataset.ignite = ignite;
  }, [ignite]);
  useLayoutEffect(() => () => void delete document.documentElement.dataset.ignite, []);

  return (
    // data-ignite drives the whole page: the dark stage, the flame, and the content that appears in
    // its light. Gated elements (.reveal) are only made transparent, never removed or hidden.
    // flex-1: the page fills the screen between the nav and the footer (see the shell in App.tsx).
    <div
      className="candle intro flex flex-1 flex-col"
      data-candle-motion={motion.running ? "running" : "paused"}
      data-candle-offscreen={offscreen}
      data-ignite={ignite}
    >
      <div ref={glowRef} aria-hidden="true" className="candle-room-glow" />
      <section aria-labelledby="welcome-heading" className="night-stage">
        <div className="stage-content">
          <FlameLogo logoRef={observedRef} />
          <h1
            id="welcome-heading"
            className="reveal reveal-1 mt-6 text-[2.25rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.25rem]"
          >
            Welcome to Candle
          </h1>
          <p className="reveal reveal-2 mt-2 text-[1.25rem] font-medium leading-snug text-muted sm:mt-3 sm:text-[1.375rem]">
            A small light for a long journey.
          </p>
          <p className="reveal reveal-3 mt-4 max-w-[48rem] text-[1.0625rem] leading-[1.6] sm:mt-6 sm:text-[1.125rem] sm:leading-[1.7]">
            Candle brings every choroideremia (CHM) clinical trial and research paper together in
            one calm place, explained in plain language and linked to its sources.
          </p>
          <div className="reveal reveal-4 mt-6 flex w-full max-w-[22rem] flex-col gap-2 sm:mt-8 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <Link to="/trials" className={`${linkButtonClass("primary")} ${FULL}`}>
              Browse clinical trials
            </Link>
            <Link to="/literature" className={`${linkButtonClass()} ${FULL}`}>
              Read the research
            </Link>
            <Link to="/ask" className={`${linkButtonClass()} ${FULL}`}>
              Ask a question
            </Link>
          </div>
          <div className="reveal reveal-5">
            <CandleToday />
          </div>
        </div>
      </section>
    </div>
  );
}
