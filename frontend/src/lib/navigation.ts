/** The three primary destinations (Trials, Literature, Ask) shown in the site nav. */
export type PrimaryDestination = {
  to: "/trials" | "/literature" | "/ask";
  label: string;
  /** One plain line for the desktop tab's tooltip: what is on the page. Not advice, not a claim about the research. */
  hint: string;
};

export const primaryDestinations: PrimaryDestination[] = [
  { to: "/trials", label: "Trials", hint: "Browse the clinical trials tracked for choroideremia" },
  { to: "/literature", label: "Literature", hint: "Search the published research papers" },
  { to: "/ask", label: "Ask", hint: "Ask a question about the trials and papers" },
];
