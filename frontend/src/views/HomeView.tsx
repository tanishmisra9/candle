/** Landing page (`/`): intro and links to the three destinations. */
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
    <section className="mx-auto flex min-h-[calc(100dvh-var(--nav-offset))] w-full max-w-[1120px] flex-col justify-start px-5 pb-12 pt-24  md:px-10 md:pb-16 md:pt-36">
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
          <div className="flex h-14 w-14 items-center justify-center rounded-panel border border-line-strong bg-panel md:h-16 md:w-16">
            <Flame strokeWidth={1.6} className="h-7 w-7 text-accent md:h-8 md:w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-[42px] font-medium tracking-[-0.045em] text-text sm:text-[48px] md:mt-5 md:text-[56px]">
            Candle
          </h1>
          <p className="mt-2.5 text-[18px] tracking-[-0.015em] text-muted sm:text-[20px] md:mt-3 md:text-[22px]">
            A small light for a long journey.
          </p>
          <p className="mt-4 hidden text-[18px] leading-[1.75] text-text md:mt-5 md:block md:text-[19px]">
            Candle aggregates every CHM clinical trial and published paper into one
            quiet place, searchable, linkable, and grounded in real data.
          </p>
          <p className="mt-3 text-[15px] text-muted sm:text-[16px] md:mt-4">
            Built by someone living with Choroideremia.
          </p>
        </motion.div>

        <motion.div
          initial={cardReveal?.initial}
          animate={cardReveal?.animate}
          transition={cardReveal?.transition}
          className="mt-8 grid w-full gap-3 md:mt-10 md:gap-4 md:grid-cols-3"
        >
          {primaryDestinations.map((destination) => (
            <div key={destination.to} className="h-full">
              <Link
                to={destination.to}
                className="group flex h-full min-h-[132px] flex-col rounded-panel border border-line bg-panel p-5 text-left transition-all duration-200 hover:border-accent md:min-h-[164px] md:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[18px] font-medium tracking-[-0.015em] text-text md:text-[20px]">
                    {destination.label}
                  </h2>
                  <ArrowRight
                    size={18}
                    strokeWidth={1.7}
                    aria-hidden="true"
                    className="mt-1 text-accent transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </div>
                <p className="mt-3 text-[14px] leading-[1.65] text-muted md:mt-4 md:text-[15px]">
                  {destination.description}
                </p>
              </Link>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
