/**
 * App shell: skip link, fixed `SiteNav`, lazy route views inside `AnimatePresence`, the stacked trial/publication snapshot overlays and the footer.
 *
 * Overlays: `selectedTrialId` / `selectedPublication` plus `publicationSnapshotLayer` decide which dialog is on top; the page content is marked `inert` while any overlay is open. Navigation scrolls to top (focus moves to the new `<h1>` in `PageTransition`).
 */
import { AnimatePresence } from "framer-motion";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { SiteNav } from "./components/SiteNav";
import { PageTransition } from "./components/PageTransition";
import { loadAsk, loadDashboard, loadLiterature, prefetchAllRoutesWhenIdle } from "./lib/routes";
import { HomeView } from "./views/HomeView";
import { PublicationSnapshot } from "./components/PublicationSnapshot";
import { TrialSnapshot } from "./components/TrialSnapshot";
import { usePageTitle } from "./hooks/usePageTitle";
import type { PublicationSummary } from "./types";

// Home is the landing page and the first paint, so it is bundled with the shell (no fallback on first
// load). The other routes are lazy but warmed early (lib/routes.ts), so they rarely suspend.
const DashboardView = lazy(() => loadDashboard().then((module) => ({ default: module.DashboardView })));
const LiteratureView = lazy(() => loadLiterature().then((module) => ({ default: module.LiteratureView })));
const AskView = lazy(() => loadAsk().then((module) => ({ default: module.AskView })));

/**
 * Shown only if a lazy route is still loading. It renders nothing for the first 250ms (so a fast load
 * never flashes anything), then fades in a few quiet blocks, with a screen-reader-only status. Full
 * viewport tall on purpose: the footer sits below this, so it stays below the fold instead of showing
 * mid-screen and jumping to the bottom of the real page (a ~0.08 layout shift on first load).
 */
function RouteFallback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-dvh pt-32" aria-busy="true">
      {visible && (
        <div role="status" className="page-fade mx-auto max-w-[40rem] space-y-4">
          <span className="sr-only">Loading</span>
          <div aria-hidden="true" className="h-8 w-2/3 bg-line/60" />
          <div aria-hidden="true" className="h-4 w-full bg-line/40" />
          <div aria-hidden="true" className="h-4 w-5/6 bg-line/40" />
        </div>
      )}
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

  // Warm the other routes' chunks once the first page has painted and the browser is idle.
  useEffect(() => prefetchAllRoutesWhenIdle(), []);

  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteNav />
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
                      <PageTransition cascade={false}>
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
                      <PageTransition cascade={false}>
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
