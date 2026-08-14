import { AnimatePresence } from "framer-motion";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { GlassNav } from "./components/GlassNav";
import { PageTransition } from "./components/PageTransition";
import { PublicationSnapshot } from "./components/PublicationSnapshot";
import { TrialSnapshot } from "./components/TrialSnapshot";
import { usePageTitle } from "./hooks/usePageTitle";
import type { PublicationSummary } from "./types";

const HomeView = lazy(() =>
  import("./views/HomeView").then((module) => ({ default: module.HomeView })),
);
const DashboardView = lazy(() =>
  import("./views/DashboardView").then((module) => ({ default: module.DashboardView })),
);
const LiteratureView = lazy(() =>
  import("./views/LiteratureView").then((module) => ({ default: module.LiteratureView })),
);
const AskView = lazy(() =>
  import("./views/AskView").then((module) => ({ default: module.AskView })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center pt-32 text-[15px] text-muted">
      Loading view…
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [selectedPublication, setSelectedPublication] = useState<PublicationSummary | null>(null);
  usePageTitle();
  const isOverlayOpen = Boolean(selectedTrialId) || Boolean(selectedPublication);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const [publicationSnapshotLayer, setPublicationSnapshotLayer] = useState<
    "above-trial" | "below-trial"
  >("below-trial");

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

  useEffect(() => {
    const node = pageContentRef.current;
    if (!node) return;
    if (isOverlayOpen) {
      node.setAttribute("inert", "");
    } else {
      node.removeAttribute("inert");
    }
  }, [isOverlayOpen]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <GlassNav />
      <div ref={pageContentRef} aria-hidden={isOverlayOpen ? true : undefined}>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1360px] px-4 pb-20 sm:px-5 md:px-10 outline-none"
        >
          <AnimatePresence mode="wait" initial>
            <Suspense fallback={<RouteFallback />}>
              <ErrorBoundary>
                <Routes location={location} key={location.pathname}>
                  <Route
                    path="/"
                    element={
                      <PageTransition>
                        <HomeView />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/trials"
                    element={
                      <PageTransition>
                        <DashboardView onOpenTrialSnapshot={openTrialSnapshot} />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/literature"
                    element={
                      <PageTransition>
                        <LiteratureView
                          onOpenPublicationSnapshot={(publication) =>
                            openPublicationSnapshot(publication, "below-trial")
                          }
                        />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/ask"
                    element={
                      <PageTransition>
                        <AskView onOpenTrialSnapshot={openTrialSnapshot} />
                      </PageTransition>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
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
