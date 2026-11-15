/** About (`/about`): what Candle does and doesn't do, the AI-accuracy caveat, and a note from the builder. The limits wording is deliberate product behaviour (same sentences as before, only re-arranged): change it only on purpose. */
import { Check, Info, Minus } from "lucide-react";
import type { ReactNode } from "react";

const H2 = "text-[1.5rem] font-semibold leading-snug tracking-tight";

function Points({ icon, items }: { icon: ReactNode; items: string[] }) {
  return (
    <ul className="mt-5 space-y-4">
      {items.map((text) => (
        <li key={text} className="flex gap-3 text-[1.0625rem] leading-[1.6]">
          <span aria-hidden="true" className="mt-[0.2rem] shrink-0 text-muted">
            {icon}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export function AboutView() {
  return (
    <div className="mx-auto max-w-[56rem] pt-28 md:pt-32">
      <h1 className="text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        About Candle
      </h1>
      <p className="mt-4 max-w-[40rem] text-balance text-[1.125rem] leading-[1.6] text-muted">
        Every choroideremia trial and research paper in one calm place, explained in plain
        language and linked to its sources.
      </p>

      <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-0">
        <section aria-labelledby="does-heading" className="md:pr-10">
          <h2 id="does-heading" className={H2}>
            What Candle does
          </h2>
          <Points
            icon={<Check size={16} strokeWidth={1.5} />}
            items={[
              "Candle collects trials from ClinicalTrials.gov and papers from PubMed, and links them where a paper names a trial.",
              "Ask only reports what is documented in those sources, and shows where each answer came from.",
            ]}
          />
        </section>
        <section aria-labelledby="doesnt-heading" className="md:border-l md:border-line md:pl-10">
          <h2 id="doesnt-heading" className={H2}>
            What Candle doesn&rsquo;t do
          </h2>
          <Points
            icon={<Minus size={16} strokeWidth={1.5} />}
            items={[
              "Candle does not give medical advice and cannot tell you which trial is right for you. Please talk with your care team about decisions.",
            ]}
          />
        </section>
      </div>

      <aside
        aria-label="Accuracy"
        className="mt-12 flex gap-3 rounded-panel border border-line-strong bg-panel p-5 text-[1.0625rem] leading-[1.6]"
      >
        <Info size={18} strokeWidth={1.5} aria-hidden="true" className="mt-[0.2rem] shrink-0 text-accent" />
        <p>
          Plain-language summaries and overviews are written by AI. They can contain mistakes, so
          please check the original record.
        </p>
      </aside>

      <section aria-labelledby="note-heading" className="mt-16 border-t border-line pt-10">
        <h2 id="note-heading" className="text-[1rem] font-semibold text-muted">
          A note from the builder
        </h2>
        <p className="mt-4 max-w-[38rem] text-[1.375rem] leading-[1.55] tracking-[-0.01em]">
          Candle exists because I also live with choroideremia. That changes the shape of the
          work. This is patient-engineering: one place to see the trial landscape clearly, follow
          the literature without noise, and keep a small light on for the long journey.
        </p>
        <a
          href="https://curechm.org"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text"
        >
          Visit the CureCHM patient community
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </section>
    </div>
  );
}
