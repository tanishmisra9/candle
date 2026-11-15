/**
 * About (`/about`): what Candle does and doesn't do, the AI-accuracy caveat, and a note from the builder.
 * The limits are deliberate product behaviour (no medical advice, summaries can be wrong): the wording is
 * short on purpose (bullets do not repeat the product name, the headings carry it) but the meaning must not
 * change. Same section format throughout: an h2 in the page's heading style, body text in the page's body style.
 */
import { Check, Info, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { BackHomeButton } from "../components/BackHomeButton";
import { LinkTile } from "../components/LinkTile";

const H2 = "text-[1.5rem] font-semibold leading-snug tracking-tight";

// The builder's public post about the release (the clean address: no share/tracking parameters).
const LINKEDIN_POST =
  "https://www.linkedin.com/posts/tanish-misra_patientadvocacy-healthtech-accessibility-share-7470308683810308096-UobM";

// The Choroideremia Research Foundation's press release about Candle (the "full story" the post links to).
const PRESS_RELEASE =
  "https://www.einpresswire.com/article/918493577/choroideremia-research-foundation-highlights-candle-a-patient-developed-resource-hub-advancing-access-to-chm-research";

function Points({ icon, items }: { icon: ReactNode; items: string[] }) {
  return (
    <ul className="mt-5 space-y-3">
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
    // One column at the full shell width (see GuideView): only the running prose is capped.
    <div className="pt-28 md:pt-32">
      <BackHomeButton />
      <h1 className="mt-6 text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-text md:text-[42px]">
        About Candle
      </h1>
      <p className="mt-4 max-w-[40rem] text-balance text-[1.125rem] leading-[1.6] text-muted">
        Every choroideremia trial and research paper in one calm place, explained in plain
        language and linked to its sources.
      </p>

      {/* Two columns from `md`; on a phone they are simply stacked, one above the other. */}
      <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-0">
        <section aria-labelledby="does-heading" className="md:pr-10">
          <h2 id="does-heading" className={H2}>
            What Candle does
          </h2>
          <Points
            icon={<Check size={16} strokeWidth={1.5} />}
            items={[
              "Collects trials from ClinicalTrials.gov",
              "Collects papers from PubMed",
              "Links a paper to a trial when it names one",
              "Ask reports only what those sources document, and shows where each answer came from",
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
              "Giving medical advice",
              "Telling you which trial is right for you",
              "Replacing your care team: please talk with them about decisions",
            ]}
          />
        </section>
      </div>

      <aside
        aria-label="Accuracy"
        className="mt-12 flex gap-3 rounded-panel border border-line-strong bg-panel p-5 text-[1.0625rem] leading-[1.6]"
      >
        <Info size={18} strokeWidth={1.5} aria-hidden="true" className="mt-[0.2rem] shrink-0 text-accent" />
        <p>AI-written summaries and overviews can contain mistakes. Please check the original record.</p>
      </aside>

      <section aria-labelledby="note-heading" className="mt-16">
        <h2 id="note-heading" className={H2}>
          A note from the builder
        </h2>
        {/* Excerpts from the builder's public LinkedIn post about the public release, in their own words
            (the people the post names are left out on purpose). Normal body text, like every section. */}
        <blockquote className="mt-3 space-y-4 text-left text-[1.125rem] leading-[1.7]">
          <p>
            I have choroideremia, a rare retinal disease that gradually causes blindness. Keeping up with
            research on my own condition was harder than it should be. The information is scattered and
            written for researchers, so I built Candle to pull it into one place with plain-language
            summaries.
          </p>
          <p>
            I shared it with the Choroideremia Research Foundation (Cure CHM), and three members of the
            CHM community tested its accessibility. They used the screen readers they rely on every day
            and helped me make the experience work better for the people it&rsquo;s actually for.
          </p>
          <p>Getting to build Candle alongside the community has been truly rewarding.</p>
        </blockquote>
        {/* The public release: the press release itself and the builder's announcement post. */}
        <ul className="mt-8 grid gap-6 md:grid-cols-2 md:gap-4">
          <li className="flex">
            <LinkTile
              href={PRESS_RELEASE}
              title="Read the press release"
              body="The Choroideremia Research Foundation highlights Candle, via EIN Presswire."
            />
          </li>
          <li className="flex">
            <LinkTile href={LINKEDIN_POST} title="Read the post on LinkedIn" body="The announcement, in my own words." />
          </li>
        </ul>
      </section>
    </div>
  );
}
