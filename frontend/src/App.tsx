import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { GlassNav } from "./components/GlassNav";
import { AskView } from "./views/AskView";
import { DashboardView } from "./views/DashboardView";
import { LiteratureView } from "./views/LiteratureView";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen">
      <GlassNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-16 md:px-8">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.28 }}
                >
                  <DashboardView />
                </motion.div>
              }
            />
            <Route
              path="/literature"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.28 }}
                >
                  <LiteratureView />
                </motion.div>
              }
            />
            <Route
              path="/ask"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.28 }}
                >
                  <AskView />
                </motion.div>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}
