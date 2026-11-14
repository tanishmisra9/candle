/** The three primary destinations (Trials, Literature, Ask) shown in the site nav. */
export type PrimaryDestination = {
  to: "/trials" | "/literature" | "/ask";
  label: string;
};

export const primaryDestinations: PrimaryDestination[] = [
  { to: "/trials", label: "Trials" },
  { to: "/literature", label: "Literature" },
  { to: "/ask", label: "Ask" },
];
