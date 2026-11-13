/** "Where would you like to start?": three audience paths as a hairline list (not cards). Links only point at existing routes and the in-page guide. */
import { Link } from "react-router-dom";

const linkClass =
  "inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text";

type PathAction = { label: string; to: string; anchor?: boolean };

const PATHS: Array<{ title: string; body: string; actions: PathAction[] }> = [
  {
    title: "I'm new to CHM research",
    body: "Start with the short guide below. It explains what choroideremia is and how to read a clinical trial. Then browse the trials: each one has a plain-language summary and a link to its official record.",
    actions: [
      { label: "Read the short guide", to: "#how-to-read-a-trial", anchor: true },
      { label: "Browse clinical trials", to: "/trials" },
    ],
  },
  {
    title: "I'm supporting someone with CHM",
    body: "Read what the research says: every paper has a plain-language overview. Ask can answer questions about what is documented, and it shows the sources it used.",
    actions: [
      { label: "Read the research", to: "/literature" },
      { label: "Ask a question", to: "/ask" },
    ],
  },
  {
    title: "I'm a researcher or clinician",
    body: "Filter trials by phase, status and sponsor, see them on a timeline, and follow the publications linked to each trial.",
    actions: [
      { label: "Explore trials", to: "/trials" },
      { label: "Search publications", to: "/literature" },
    ],
  },
];

export function StartPaths() {
  return (
    <section aria-labelledby="start-heading" className="mt-16 border-t border-line pt-10">
      <h2 id="start-heading" className="text-[1.75rem] font-semibold leading-tight tracking-tight">
        Where would you like to start?
      </h2>
      <ul className="mt-6">
        {PATHS.map((path) => (
          <li key={path.title} className="border-t border-line py-6 first:border-t-0 first:pt-0">
            <h3 className="text-[1.25rem] font-semibold leading-snug">{path.title}</h3>
            <p className="mt-2 text-[1.125rem] leading-[1.7]">{path.body}</p>
            <p className="mt-2 flex flex-wrap gap-x-6">
              {path.actions.map((action) =>
                action.anchor ? (
                  // Plain anchor: React Router's <Link> doesn't scroll to in-page hashes.
                  <a key={action.label} href={action.to} className={linkClass}>
                    {action.label}
                  </a>
                ) : (
                  <Link key={action.label} to={action.to} className={linkClass}>
                    {action.label}
                  </Link>
                ),
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
