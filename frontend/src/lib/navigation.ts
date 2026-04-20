export type PrimaryDestination = {
  to: "/trials" | "/literature" | "/ask";
  label: string;
  description: string;
};

export const primaryDestinations: PrimaryDestination[] = [
  {
    to: "/trials",
    label: "Trials",
    description: "Browse every CHM clinical trial.",
  },
  {
    to: "/literature",
    label: "Literature",
    description: "Read CHM papers with summaries and source links.",
  },
  {
    to: "/ask",
    label: "Ask",
    description: "Ask grounded questions across the full CHM evidence base.",
  },
];
