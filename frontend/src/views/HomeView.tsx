import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { Link } from "react-router-dom";

import { primaryDestinations } from "../lib/navigation";

const entryEase = [0.22, 1, 0.36, 1] as const;

export function HomeView() {
  const prefersReducedMotion = useReducedMotion();
  const reveal = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: entryEase },
      };
  const cardReveal = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, delay: 0.08, ease: entryEase },
      };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1120px] flex-col justify-start px-8 pb-16 pt-32 md:px-10 md:pt-36">
      <motion.div
        initial={reveal?.initial}
        animate={reveal?.animate}
        transition={reveal?.transition}
        className="mx-auto flex w-full max-w-[960px] flex-col items-center"
      >
        <motion.div
          initial={reveal?.initial}
          animate={reveal?.animate}
          transition={reveal?.transition}
          className="flex w-full max-w-[720px] flex-col items-center text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(232,163,61,0.10)] shadow-[0_0_28px_rgba(232,163,61,0.14)]">
            <Flame size={32} strokeWidth={1.6} className="text-accent" />
          </div>
          <h1 className="mt-5 text-[48px] font-medium tracking-[-0.045em] text-text sm:text-[56px]">
            Candle
          </h1>
          <p className="mt-3 text-[20px] tracking-[-0.015em] text-muted sm:text-[22px]">
            A small light for a long journey.
          </p>
          <p className="mt-5 text-[18px] leading-[1.75] text-[rgba(245,245,247,0.78)] sm:text-[19px]">
            Candle aggregates every CHM clinical trial and published paper into one
            quiet place, searchable, linkable, and grounded in real data.
          </p>
          <p className="mt-4 text-[15px] text-muted opacity-80 sm:text-[16px]">
            Built by someone living with Choroideremia.
          </p>
        </motion.div>

        <motion.div
          initial={cardReveal?.initial}
          animate={cardReveal?.animate}
          transition={cardReveal?.transition}
          className="mt-10 grid w-full gap-4 md:grid-cols-3"
        >
          {primaryDestinations.map((destination) => (
            <motion.div
              key={destination.to}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { y: -3, transition: { duration: 0.22, ease: entryEase } }
              }
              className="h-full"
            >
              <Link
                to={destination.to}
                className="group flex h-full min-h-[164px] flex-col rounded-card border border-line bg-panel p-6 text-left shadow-panel transition-all duration-200 hover:border-[rgba(232,163,61,0.22)] hover:bg-[rgba(21,21,27,0.98)] hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[20px] font-medium tracking-[-0.015em] text-text">
                    {destination.label}
                  </h2>
                  <ArrowRight
                    size={18}
                    strokeWidth={1.7}
                    className="mt-1 text-accent opacity-70 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </div>
                <p className="mt-4 text-[15px] leading-[1.65] text-muted">
                  {destination.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
