import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { GlassNav } from "./components/GlassNav";
import { PublicationSnapshot } from "./components/PublicationSnapshot";
import { TrialSnapshot } from "./components/TrialSnapshot";
import type { PublicationSummary } from "./types";
import { AskView } from "./views/AskView";
import { DashboardView } from "./views/DashboardView";
import { HomeView } from "./views/HomeView";
import { LiteratureView } from "./views/LiteratureView";

export default function App() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [selectedPublication, setSelectedPublication] = useState<PublicationSummary | null>(null);
  const [publicationSnapshotLayer, setPublicationSnapshotLayer] = useState<
    "above-trial" | "below-trial"
  >("below-trial");
  const pageTransition = {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  function openTrialSnapshot(trialId: string) {
    if (selectedPublication) {
      setPublicationSnapshotLayer("below-trial");
    }
    setSelectedTrialId(trialId);
  }

  function openPublicationSnapshot(
    publication: PublicationSummary,
    layer: "above-trial" | "below-trial" = "below-trial",
  ) {
    setPublicationSnapshotLayer(layer);
    setSelectedPublication(publication);
  }

  function closePublicationSnapshot() {
    setSelectedPublication(null);
    setPublicationSnapshotLayer("below-trial");
  }

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
              <Route path="/" element={<HomeView />} />
              <Route
                path="/trials"
                element={<DashboardView onOpenTrialSnapshot={openTrialSnapshot} />}
              />
              <Route
                path="/literature"
                element={
                  <LiteratureView
                    onOpenPublicationSnapshot={(publication) =>
                      openPublicationSnapshot(publication, "below-trial")
                    }
                  />
                }
              />
              <Route
                path="/ask"
                element={<AskView onOpenTrialSnapshot={openTrialSnapshot} />}
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <TrialSnapshot
        trialId={selectedTrialId}
        onClose={() => setSelectedTrialId(null)}
        onOpenPublicationSnapshot={(publication) =>
          openPublicationSnapshot(publication, "above-trial")
        }
        isPublicationSnapshotOpen={Boolean(selectedPublication)}
        publicationSnapshotLayer={publicationSnapshotLayer}
      />
      <PublicationSnapshot
        publication={selectedPublication}
        onClose={closePublicationSnapshot}
        onOpenTrialSnapshot={openTrialSnapshot}
        layer={publicationSnapshotLayer}
        isTrialSnapshotOpen={Boolean(selectedTrialId)}
      />
    </div>
  );
}
