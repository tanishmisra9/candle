/** Display formatting for ClinicalTrials.gov enums (status, phase, intervention type): e.g. `ACTIVE_NOT_RECRUITING` -> "Active Not Recruiting", `PHASE2/PHASE3` -> "Phase 2 / Phase 3". Null maps to "Unknown" / "Unspecified". */
function titleCaseWords(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Canonical form of a ClinicalTrials.gov status for comparisons: upper case, runs of
 * non-alphanumerics collapsed to `_`, no leading/trailing `_` ("Active, not recruiting" ->
 * "ACTIVE_NOT_RECRUITING"). Used by both `StatusBadge` and `Timeline` so they never disagree.
 */
export function normalizeStatus(status: string | null) {
  return (status ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function formatStatusLabel(status: string | null) {
  if (!status) return "Unknown";
  return titleCaseWords(status);
}

export function formatPhaseLabel(phase: string | null) {
  if (!phase) return "Unspecified";

  return phase
    .split("/")
    .map((part) => {
      const normalized = part.replace(/_/g, " ").trim();
      if (!normalized) return "";
      if (/^na$/i.test(normalized)) return "N/A";

      const compact = normalized.replace(/\s+/g, "").toUpperCase();
      if (compact.startsWith("PHASE")) {
        const suffix = compact.slice("PHASE".length);
        return suffix ? `Phase ${suffix}` : "Phase";
      }
      return titleCaseWords(normalized);
    })
    .filter(Boolean)
    .join(" / ");
}

export function formatInterventionTypeLabel(type: string | null) {
  if (!type) return "Unknown";
  return titleCaseWords(type.replace(/\//g, " / "));
}

/** "3 sites in United States, United Kingdom +1" (words, not icons). Used by the card (capped) and the trial dialog (all countries). */
export function formatSitesLabel(
  locations: Array<{ country?: string | null }>,
  maxCountries = Infinity,
) {
  if (locations.length === 0) return "Sites not listed";
  const count = `${locations.length} site${locations.length === 1 ? "" : "s"}`;
  const countries = Array.from(
    new Set(locations.map((location) => location.country?.trim()).filter((c): c is string => Boolean(c))),
  );
  if (countries.length === 0) return count;
  const more = countries.length - maxCountries;
  return `${count} in ${countries.slice(0, maxCountries).join(", ")}${more > 0 ? ` +${more}` : ""}`;
}

/**
 * "1,178 participants" (grouped in the viewer's locale: 20000 and 1178 were unreadable), "1 participant", "None enrolled" for a
 * trial that enrolled nobody (a withdrawn one printed "0 participants", which reads like an error), or "Participants not listed".
 * Shared by the trial card and dialog.
 */
export function formatParticipants(enrollment: number | null) {
  if (enrollment === null) return "Participants not listed";
  if (enrollment === 0) return "None enrolled";
  return `${new Intl.NumberFormat().format(enrollment)} participant${enrollment === 1 ? "" : "s"}`;
}

/** "Smith et al." for several authors, "Smith" for one (the dialog printed "Smith et al." for a sole author), "Unknown author" for none. */
export function formatLeadAuthor(authors: string[]) {
  const lead = authors[0]?.split(",")[0]?.trim();
  if (!lead) return "Unknown author";
  return authors.length > 1 ? `${lead} et al.` : lead;
}

/** "Smith et al., 2021": the one citation format (rows, the paper dialog and a trial's linked papers each had their own). "n.d." when undated. */
export function formatCitation(authors: string[], pubDate: string | null) {
  return `${formatLeadAuthor(authors)}, ${pubDate?.slice(0, 4) || "n.d."}`;
}

/**
 * A publication title as shown. PubMed ends nearly every title with a full stop (479 of 482 here), which is clutter in a heading and
 * a list. Only after a lowercase letter, digit or bracket, so an abbreviation at the end ("... the U.S.") keeps its own.
 */
export function displayTitle(title: string) {
  return title.replace(/([a-z0-9)\]])\.$/, "$1");
}

/**
 * "Oct 2011" for an API date ("2011-10-01", "2011-10" or "2011"). Formatted in UTC: those strings parse as UTC midnight, so
 * formatting in the viewer's timezone printed the PREVIOUS month for everyone west of UTC (the Americas). A missing date is
 * "Unknown"; a value that is not a date is returned as-is.
 */
export function formatMonthYear(value: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}
