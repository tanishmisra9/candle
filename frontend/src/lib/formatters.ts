function titleCaseWords(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
