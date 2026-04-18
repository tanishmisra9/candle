import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { GlassNav } from "./components/GlassNav";
import { TrialSnapshot } from "./components/TrialSnapshot";
import { AskView } from "./views/AskView";
import { DashboardView } from "./views/DashboardView";
import { LiteratureView } from "./views/LiteratureView";

export default function App() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const pageTransition = {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen">
      <GlassNav />
      <main className="mx-auto max-w-[1360px] px-7 pb-20 md:px-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, filter: "blur(16px)" }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, filter: "blur(0px)" }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, filter: "blur(10px)" }
            }
            transition={pageTransition}
            style={{ willChange: "opacity, filter, transform" }}
          >
            <Routes location={location}>
              <Route
                path="/"
                element={<DashboardView onOpenTrialSnapshot={setSelectedTrialId} />}
              />
              <Route
                path="/literature"
                element={
                  <LiteratureView
                    onOpenTrialSnapshot={setSelectedTrialId}
                    isTrialSnapshotOpen={Boolean(selectedTrialId)}
                  />
                }
              />
              <Route path="/ask" element={<AskView />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <TrialSnapshot
        trialId={selectedTrialId}
        onClose={() => setSelectedTrialId(null)}
      />
    </div>
  );
}
