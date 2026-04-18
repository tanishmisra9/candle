import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, CalendarRange, Mail, MapPin, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { getTrial } from "../lib/api";
import { formatStatusLabel } from "../lib/formatters";
import { Button } from "./ui/Button";

const SNAPSHOT_SECTION_HEADING_CLASS =
  "text-[13px] font-medium uppercase tracking-[0.16em] text-muted";

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

function formatLocationLine(city?: string | null, country?: string | null) {
  const parts = [city, country].filter((value): value is string => Boolean(value?.trim()));
  return parts.join(", ");
}

function formatLocationCountLabel(count: number) {
  return `${count} location${count === 1 ? "" : "s"}`;
}

function formatMoreLocationsLabel(count: number) {
  return `Show ${count} more location${count === 1 ? "" : "s"}`;
}

type TrialSnapshotProps = {
  trialId: string | null;
  onClose: () => void;
};

export function TrialSnapshot({ trialId, onClose }: TrialSnapshotProps) {
  const [showAllLocations, setShowAllLocations] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["trial", trialId],
    queryFn: () => getTrial(trialId as string),
    enabled: Boolean(trialId),
  });

  useEffect(() => {
    if (!trialId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [trialId]);

  useEffect(() => {
    if (!trialId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, trialId]);

  useEffect(() => {
    setShowAllLocations(false);
  }, [trialId]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {trialId ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end overflow-y-auto bg-[rgba(11,11,15,0.28)] p-4 backdrop-blur-sm md:items-start md:justify-center md:px-6 md:pb-6 md:pt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[min(88vh,920px)] w-full flex-col overflow-hidden rounded-[30px] border border-line bg-panel shadow-panel md:h-[min(calc(100vh-7rem),920px)] md:max-w-[1040px]"
          >
            <div className="border-b border-line bg-panel/92 px-6 pb-5 pt-6 backdrop-blur-xl md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[820px]">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-muted">
                    {detailQuery.data?.id}
                  </p>
                  <h2 className="mt-2 text-[28px] font-medium tracking-[-0.03em] text-text md:text-[32px]">
                    {detailQuery.data?.title}
                  </h2>
                </div>
                <Button variant="ghost" onClick={onClose}>
                  <X size={18} strokeWidth={1.5} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 md:px-8 md:pb-8">
              {detailQuery.isLoading ? (
                <p className="text-[14px] text-muted">Loading trial details…</p>
              ) : detailQuery.data ? (
                <div className="grid gap-8 md:grid-cols-[1.25fr_0.75fr]">
                  <div className="space-y-8">
                    <section className="space-y-3">
                      <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Snapshot</h3>
                      <p className="text-[15px] leading-7 text-text">
                        {detailQuery.data.intervention || "Intervention details not reported."}
                      </p>
                      <div className="grid gap-3 text-[14px] text-muted">
                        <div className="inline-flex items-center gap-2">
                          <Activity size={16} strokeWidth={1.5} />
                          {formatStatusLabel(detailQuery.data.status)}
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <CalendarRange size={16} strokeWidth={1.5} />
                          {formatDate(detailQuery.data.start_date)} to{" "}
                          {formatDate(detailQuery.data.completion_date)}
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <MapPin size={16} strokeWidth={1.5} />
                          {formatLocationCountLabel(detailQuery.data.locations.length)} listed
                        </div>
                        {detailQuery.data.contact_email ? (
                          <div className="inline-flex items-center gap-2">
                            <Mail size={16} strokeWidth={1.5} />
                            {detailQuery.data.contact_email}
                          </div>
                        ) : null}
                      </div>
                      <a
                        href={detailQuery.data.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-[14px] text-muted transition hover:text-text"
                      >
                        ClinicalTrials.gov
                      </a>
                      {detailQuery.data.locations.length ? (
                        <motion.div layout className="space-y-3 pt-2">
                          <h4 className={SNAPSHOT_SECTION_HEADING_CLASS}>Locations</h4>
                          <div className="space-y-2">
                            {detailQuery.data.locations.slice(0, 3).map((location, index) => {
                              const locationLine = formatLocationLine(
                                location.city,
                                location.country,
                              );
                              const locationTitle =
                                location.facility?.trim() ||
                                locationLine ||
                                `Location ${index + 1}`;

                              return (
                                <div
                                  key={`${locationTitle}-${index}`}
                                  className="rounded-[16px] border border-line px-4 py-3"
                                >
                                  <p className="text-[14px] font-medium text-text">
                                    {locationTitle}
                                  </p>
                                  {location.facility?.trim() && locationLine ? (
                                    <p className="mt-1 text-[13px] text-muted">{locationLine}</p>
                                  ) : null}
                                  {location.status ? (
                                    <p className="mt-1 text-[13px] text-muted">
                                      {location.status}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                            <motion.div
                              initial={false}
                              animate={{
                                height: showAllLocations ? "auto" : 0,
                                opacity: showAllLocations ? 1 : 0,
                                filter: showAllLocations ? "blur(0px)" : "blur(8px)",
                              }}
                              transition={{
                                height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                                filter: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                              }}
                              className="overflow-hidden"
                              style={{ pointerEvents: showAllLocations ? "auto" : "none" }}
                            >
                              <div className="space-y-2 pt-2">
                                {detailQuery.data.locations.slice(3).map((location, index) => {
                                  const locationLine = formatLocationLine(
                                    location.city,
                                    location.country,
                                  );
                                  const locationTitle =
                                    location.facility?.trim() ||
                                    locationLine ||
                                    `Location ${index + 4}`;

                                  return (
                                    <div
                                      key={`${locationTitle}-${index + 3}`}
                                      className="rounded-[16px] border border-line px-4 py-3"
                                    >
                                      <p className="text-[14px] font-medium text-text">
                                        {locationTitle}
                                      </p>
                                      {location.facility?.trim() && locationLine ? (
                                        <p className="mt-1 text-[13px] text-muted">
                                          {locationLine}
                                        </p>
                                      ) : null}
                                      {location.status ? (
                                        <p className="mt-1 text-[13px] text-muted">
                                          {location.status}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          </div>
                          {detailQuery.data.locations.length > 3 ? (
                            <button
                              type="button"
                              onClick={() => setShowAllLocations((current) => !current)}
                              className="inline-flex text-[14px] text-muted transition hover:text-text"
                            >
                              {showAllLocations
                                ? "Show fewer locations"
                                : formatMoreLocationsLabel(
                                    detailQuery.data.locations.length - 3,
                                  )}
                            </button>
                          ) : null}
                        </motion.div>
                      ) : null}
                    </section>

                    <section className="space-y-3">
                      <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Outcomes</h3>
                      <div className="space-y-3">
                        {detailQuery.data.outcomes.length ? (
                          detailQuery.data.outcomes.map((outcome, index) => (
                            <div
                              key={`${outcome.outcome_type}-${index}`}
                              className="rounded-[18px] border border-line p-4"
                            >
                              <p className="text-[12px] uppercase tracking-[0.14em] text-muted">
                                {outcome.outcome_type}
                              </p>
                              <p className="mt-2 text-[15px] font-medium text-text">
                                {outcome.measure}
                              </p>
                              {outcome.timeframe ? (
                                <p className="mt-1 text-[13px] text-muted">{outcome.timeframe}</p>
                              ) : null}
                              {outcome.description ? (
                                <p className="mt-2 text-[14px] leading-6 text-muted">
                                  {outcome.description}
                                </p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-[14px] text-muted">
                            No structured outcomes were available in the upstream record.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-3">
                    <h3 className={SNAPSHOT_SECTION_HEADING_CLASS}>Linked Literature</h3>
                    <div className="space-y-3">
                      {detailQuery.data.publications.length ? (
                        detailQuery.data.publications.map((publication) => (
                          <Link
                            key={publication.pmid}
                            to={`/literature?pmid=${publication.pmid}`}
                            onClick={onClose}
                            className="block rounded-[18px] border border-line p-4 transition hover:border-[rgba(232,163,61,0.22)]"
                          >
                            <p className="text-[15px] font-medium leading-6 text-text">
                              {publication.title}
                            </p>
                            <p className="mt-2 text-[13px] text-muted">
                              {publication.authors[0]?.split(",")[0] ?? "Unknown author"} et al.
                              {publication.pub_date ? `, ${publication.pub_date.slice(0, 4)}` : ""}
                            </p>
                          </Link>
                        ))
                      ) : (
                        <p className="text-[14px] text-muted">
                          No linked publications yet for this trial.
                        </p>
                      )}
                    </div>
                  </aside>
                </div>
              ) : (
                <p className="text-[14px] text-muted">Trial details could not be loaded.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
