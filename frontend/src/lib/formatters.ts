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
