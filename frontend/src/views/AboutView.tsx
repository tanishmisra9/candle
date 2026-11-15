/** About (`/about`): what Candle does and doesn't do, and a note from the builder. The limits wording is deliberate product behaviour: change it only on purpose. */
export function AboutView() {
  return (
    <div className="mx-auto max-w-[40rem] pt-28 md:pt-32">
      <h1 className="text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        About Candle
      </h1>

      <section aria-labelledby="limits-heading" className="mt-10">
        <h2 id="limits-heading" className="text-[1.375rem] font-semibold leading-snug">
          What Candle does, and what it doesn&rsquo;t
        </h2>
        <ul className="mt-4 list-disc space-y-3 pl-6 text-[1.125rem] leading-[1.7]">
          <li>
            Candle collects trials from ClinicalTrials.gov and papers from PubMed, and links them
            where a paper names a trial.
          </li>
          <li>
            Plain-language summaries and overviews are written by AI. They can contain mistakes,
            so please check the original record.
          </li>
          <li>
            Ask only reports what is documented in those sources, and shows where each answer came
            from.
          </li>
          <li>
            Candle does not give medical advice and cannot tell you which trial is right for you.
            Please talk with your care team about decisions.
          </li>
        </ul>
      </section>

      <section aria-labelledby="note-heading" className="mt-12">
        <h2 id="note-heading" className="text-[1.375rem] font-semibold leading-snug">
          A note from the builder
        </h2>
        <p className="mt-4 text-[1.125rem] leading-[1.7]">
          Candle exists because I also live with choroideremia. That changes the shape of the
          work. This is patient-engineering: one place to see the trial landscape clearly, follow
          the literature without noise, and keep a small light on for the long journey.
        </p>
        <p className="mt-2">
          <a
            href="https://curechm.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-text"
          >
            Visit the CureCHM patient community
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>
    </div>
  );
}
