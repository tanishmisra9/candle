import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import { Search } from "lucide-react";

import { PublicationRow } from "../components/PublicationRow";
import { cn } from "../lib/cn";
import { listPublications } from "../lib/api";

export function LiteratureView() {
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [compactControls, setCompactControls] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let lastValue = 0;
    return scrollY.on("change", (value) => {
      const goingDown = value > lastValue;
      if (value < 90) {
        setCompactControls(false);
      } else if (goingDown && value > 180) {
        setCompactControls(true);
      } else if (!goingDown) {
        setCompactControls(false);
      }
      lastValue = value;
    });
  }, [scrollY]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const publicationsQuery = useQuery({
    queryKey: ["publications", deferredSearch],
    queryFn: () =>
      listPublications({
        q: deferredSearch || undefined,
        limit: 500,
      }),
  });

  const publications = (publicationsQuery.data ?? []).filter((item) =>
    linkedOnly ? Boolean(item.trial_id) : true,
  );

  return (
    <div className="space-y-10 pb-16 pt-28">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Publications</p>
        <h1 className="text-[32px] font-medium tracking-[-0.02em] text-text">
          {publications.length} publications tracked
        </h1>
        <p className="text-[15px] text-muted">
          The literature connected to CHM, with trial links where they can be found.
        </p>
      </header>

      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : {
                y: compactControls ? -4 : 0,
                paddingTop: compactControls ? 10 : 16,
                paddingBottom: compactControls ? 10 : 16,
              }
        }
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="glass-nav sticky top-[88px] z-30 flex flex-col gap-3 rounded-[22px] px-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="relative grid w-[188px] grid-cols-2 self-start rounded-full border border-line bg-[rgba(255,255,255,0.36)] p-1 dark:bg-[rgba(255,255,255,0.04)]">
          <motion.span
            animate={
              prefersReducedMotion
                ? undefined
                : { x: linkedOnly ? "100%" : "0%" }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.18 }
                : { type: "spring", stiffness: 320, damping: 30, mass: 0.8 }
            }
            className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[rgba(232,163,61,0.14)] shadow-[inset_0_0_0_1px_rgba(232,163,61,0.18)]"
          />
          {[
            { label: "All", value: false },
            { label: "Linked", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setLinkedOnly(option.value)}
              className={cn(
                "relative rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-200",
                linkedOnly === option.value
                  ? "text-text"
                  : "text-muted hover:text-text",
              )}
            >
              <span className="relative z-10">{option.label}</span>
            </button>
          ))}
        </div>

        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: compactControls ? 0.985 : 1,
                }
          }
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="relative w-full md:max-w-[360px]"
        >
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or abstract"
            className={cn(
              "w-full rounded-full border border-line bg-glass pl-11 pr-14 text-[14px] text-text shadow-panel outline-none backdrop-blur-2xl placeholder:text-muted transition-all focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              compactControls ? "py-2.5" : "py-3",
            )}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            ⌘K
          </span>
        </motion.div>
      </motion.div>

      <div className="rounded-card border border-line bg-panel px-6 shadow-panel">
        {publications.map((publication) => (
          <PublicationRow key={publication.pmid} publication={publication} />
        ))}
        {!publications.length ? (
          <div className="px-1 py-10 text-[14px] text-muted">
            No publications matched this filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
