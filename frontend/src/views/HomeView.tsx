import { motion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

const entryEase = [0.25, 0.1, 0.25, 1] as const;

function childTransition(delay: number) {
  return {
    duration: 0.35,
    delay,
    ease: entryEase,
  };
}

export function HomeView() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[760px] flex-col justify-center px-8 pt-20 text-center md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: entryEase }}
        className="mx-auto w-full"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0)}
          className="flex justify-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(232,163,61,0.10)] shadow-[0_0_40px_rgba(232,163,61,0.14)]">
            <Flame size={50} strokeWidth={1.5} className="text-accent" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0.06)}
        >
          <h1 className="mt-7 text-[56px] font-medium tracking-[-0.045em] text-text sm:text-[70px]">
            Candle
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0.12)}
        >
          <p className="mt-3 text-[21px] tracking-[-0.015em] text-muted sm:text-[24px]">
            A small light for a long journey.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0.18)}
          className="flex justify-center"
        >
          <div className="my-9 w-16 border-t border-line opacity-40" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0.24)}
        >
          <p className="text-[18px] leading-[1.75] text-muted sm:text-[19px]">
            Candle aggregates every CHM clinical trial and published paper into one
            quiet place, searchable, linkable, and grounded in real data.
          </p>
          <p className="mt-4 text-[15px] text-muted opacity-70 sm:text-[16px]">
            Built by someone living with Choroideremia.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={childTransition(0.32)}
          className="flex justify-center"
        >
          <button
            type="button"
            onClick={() => navigate("/trials")}
            className="mt-11 inline-flex items-center rounded-full border border-[rgba(232,163,61,0.22)] bg-[rgba(232,163,61,0.14)] px-8 py-3.5 text-[16px] font-medium text-accent transition-colors duration-200 hover:bg-[rgba(232,163,61,0.22)]"
          >
            See Trials
            <ArrowRight size={16} strokeWidth={1.7} className="ml-2 opacity-70" />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
