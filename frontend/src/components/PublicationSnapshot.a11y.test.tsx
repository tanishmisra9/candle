import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { configureAxe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicationOverview } from "../lib/api";
import type { PublicationSummary } from "../types";
import { PublicationSnapshot } from "./PublicationSnapshot";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

vi.mock("../lib/api", () => ({
  getPublicationOverview: vi.fn().mockResolvedValue({ overview: "AI overview text." }),
}));

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("../lib/mobile", () => ({
  useIsMobile: () => viewport.mobile,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  type MockMotionDivProps = React.HTMLAttributes<HTMLDivElement> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
  };
  type MockMotionPProps = React.HTMLAttributes<HTMLParagraphElement> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
  };
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, MockMotionDivProps>(
    ({ animate: _animate, exit: _exit, initial: _initial, transition: _transition, children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );
  const MotionP = ReactModule.forwardRef<HTMLParagraphElement, MockMotionPProps>(
    ({ animate: _animate, exit: _exit, initial: _initial, transition: _transition, children, ...props }, ref) => (
      <p ref={ref} {...props}>
        {children}
      </p>
    ),
  );
  type MockMotionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
    whileTap?: unknown;
  };
  const MotionButton = ReactModule.forwardRef<HTMLButtonElement, MockMotionButtonProps>(
    ({ animate: _animate, exit: _exit, initial: _initial, transition: _transition, whileTap: _whileTap, children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    ),
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: { div: MotionDiv, p: MotionP, button: MotionButton },
    useReducedMotion: () => false,
  };
});

function makePublication(): PublicationSummary {
  return {
    pmid: "12345",
    title: "Example CHM Publication",
    authors: ["Smith, J"],
    journal: "Ophthalmology",
    pub_date: "2024-01-01",
    abstract: "Abstract text.",
    trial_id: "NCT12345678",
    doi: null,
    url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
  };
}

function PublicationSnapshotHarness() {
  const [publication, setPublication] = useState<PublicationSummary | null>(null);

  return (
    <>
      <button type="button" onClick={() => setPublication(makePublication())}>
        Open publication
      </button>
      <PublicationSnapshot
        publication={publication}
        onClose={() => setPublication(null)}
        onOpenTrialSnapshot={() => {}}
        layer="below-trial"
        isTrialSnapshotOpen={false}
      />
    </>
  );
}

describe("PublicationSnapshot accessibility", () => {
  it("renders an accessible dialog, announces opening, and restores focus", async () => {
    const user = userEvent.setup();
    render(<PublicationSnapshotHarness />);

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    const trigger = screen.getByRole("button", { name: "Open publication" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Example CHM Publication" });
    const results = await axe(document.body);

    expect(results.violations).toHaveLength(0);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(liveRegion).toHaveTextContent("Example CHM Publication details opened");

    await user.click(screen.getByRole("button", { name: /close publication details/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});

describe("PublicationSnapshot scrolling on a phone", () => {
  beforeEach(() => {
    viewport.mobile = true;
  });
  afterEach(() => {
    viewport.mobile = false;
  });

  it("does not resize the header while the content scrolls, and contains a drag at the end", async () => {
    const user = userEvent.setup();
    render(<PublicationSnapshotHarness />);
    await user.click(screen.getByRole("button", { name: "Open publication" }));
    const dialog = await screen.findByRole("dialog", { name: "Example CHM Publication" });
    const title = screen.getByRole("heading", { level: 2 });
    const header = screen.getByTestId("snapshot-header");
    const scroller = screen.getByTestId("snapshot-scroll");
    const before = { header: header.className, title: title.className, style: header.getAttribute("style") };

    for (const top of [10, 28, 60, 400, 12, 0]) {
      // jsdom ignores assignments to scrollTop: define a real value, as a browser reports during a scroll.
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: top });
      fireEvent.scroll(scroller);
      // At EVERY step, not just at the end (the loop finishes back at 0, which would hide a header that
      // shrinks while scrolled and recovers).
      expect({ header: header.className, title: title.className, style: header.getAttribute("style") }, `at scrollTop ${top}`).toEqual(before);
    }

    expect(title.className).toContain("text-[26px]");
    expect(header.getAttribute("style")).toBeNull();
    expect(scroller.className).toContain("overscroll-contain");
    expect(dialog.parentElement!.className).toContain("overscroll-contain");
  });
});

describe("PublicationSnapshot page scroll lock", () => {
  it("locks <html> and <body> while open and releases both when it closes", async () => {
    const user = userEvent.setup();
    render(<PublicationSnapshotHarness />);
    await user.click(screen.getByRole("button", { name: "Open publication" }));
    await screen.findByRole("dialog", { name: "Example CHM Publication" });
    expect([document.documentElement.style.overflow, document.body.style.overflow]).toEqual(["hidden", "hidden"]);
    await user.click(screen.getByRole("button", { name: /close publication details/i }));
    await waitFor(() => {
      expect([document.documentElement.style.overflow, document.body.style.overflow]).toEqual(["", ""]);
    });
  });
});

describe("PublicationSnapshot overview", () => {
  beforeEach(() => {
    vi.mocked(getPublicationOverview).mockReset();
  });

  it("fetches again when reopened after closing before the first answer landed (it used to say 'Generating summary…' forever)", async () => {
    vi.mocked(getPublicationOverview)
      .mockImplementationOnce(() => new Promise(() => {})) // first open: never answers
      .mockResolvedValueOnce({ overview: "Second open answer." });
    const user = userEvent.setup();
    render(<PublicationSnapshotHarness />);

    await user.click(screen.getByRole("button", { name: "Open publication" }));
    expect(await screen.findByText("Generating summary…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close publication details/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Open publication" }));
    expect(await screen.findByText("Second open answer.")).toBeInTheDocument();
    expect(getPublicationOverview).toHaveBeenCalledTimes(2);
  });

  it("offers 'Try again' after a failure, and it fetches again", async () => {
    vi.mocked(getPublicationOverview)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ overview: "Recovered answer." });
    const user = userEvent.setup();
    render(<PublicationSnapshotHarness />);

    await user.click(screen.getByRole("button", { name: "Open publication" }));
    expect(await screen.findByText("Summary unavailable right now.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Recovered answer.")).toBeInTheDocument();
    expect(screen.queryByText("Summary unavailable right now.")).not.toBeInTheDocument();
  });

  it("on a phone, shows the whole title, the journal line and ONE PubMed link above the summary", async () => {
    viewport.mobile = true;
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "x" });
    try {
      const user = userEvent.setup();
      render(<PublicationSnapshotHarness />);
      await user.click(screen.getByRole("button", { name: "Open publication" }));
      await screen.findByRole("dialog", { name: "Example CHM Publication" });

      const links = screen.getAllByRole("link", { name: /Read on PubMed/ });
      expect(links).toHaveLength(1);
      const summary = screen.getByText("AI summary");
      expect(links[0].compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText(/^Ophthalmology · /)).toBeInTheDocument();
    } finally {
      viewport.mobile = false;
    }
  });
});

describe("PublicationSnapshot stacked on a trial", () => {
  it("says which trial is underneath and closes only itself on 'Back to'", async () => {
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "x" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicationSnapshot
        publication={makePublication()}
        onClose={onClose}
        onOpenTrialSnapshot={() => {}}
        layer="above-trial"
        isTrialSnapshotOpen
        underneath="trial NCT12345678"
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Back to trial NCT12345678" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog panel positioned, so sr-only text inside it cannot make the fixed overlay scrollable", async () => {
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "x" });
    render(
      <PublicationSnapshot
        publication={makePublication()}
        onClose={() => {}}
        onOpenTrialSnapshot={() => {}}
        layer="below-trial"
        isTrialSnapshotOpen={false}
      />,
    );
    expect((await screen.findByRole("dialog")).className).toContain("relative");
  });

  it("has no Back button when it is the only dialog", async () => {
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "x" });
    render(
      <PublicationSnapshot
        publication={makePublication()}
        onClose={() => {}}
        onOpenTrialSnapshot={() => {}}
        layer="below-trial"
        isTrialSnapshotOpen={false}
      />,
    );
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
  });
});

describe("PublicationSnapshot abstract", () => {
  it("shows a structured abstract as labelled paragraphs, not one block", async () => {
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "x" });
    render(
      <PublicationSnapshot
        publication={{ ...makePublication(), abstract: "BACKGROUND: Rare.\n\nMETHODS: A cohort.\n\nFINDINGS: It worked." }}
        onClose={() => {}}
        onOpenTrialSnapshot={() => {}}
        layer="below-trial"
        isTrialSnapshotOpen={false}
      />,
    );
    const dialog = await screen.findByRole("dialog");
    expect([...dialog.querySelectorAll("strong")].map((s) => s.textContent)).toEqual(["BACKGROUND:", "METHODS:", "FINDINGS:"]);
  });
});

describe("PublicationSnapshot hierarchy", () => {
  it("names the source as the original abstract, and does not let the AI text outrank it", async () => {
    vi.mocked(getPublicationOverview).mockResolvedValue({ overview: "A plain summary." });
    render(
      <PublicationSnapshot
        publication={makePublication()}
        onClose={() => {}}
        onOpenTrialSnapshot={() => {}}
        layer="below-trial"
        isTrialSnapshotOpen={false}
      />,
    );
    const summary = await screen.findByText("A plain summary.");
    expect(screen.getByRole("heading", { level: 3, name: "Original abstract (PubMed)" })).toBeInTheDocument();
    // Same size as the abstract it summarises (it was 16px against 15px).
    expect(summary.className).toContain("text-[15px]");
    expect(screen.getByText("Abstract text.").closest("div")?.className).toContain("text-[15px]");
    // The note says what it was written from, in the trial dialog's wording.
    expect(screen.getByText(/Written by AI from the abstract below, so it can contain mistakes/)).toBeInTheDocument();
    expect(screen.getByText(/Always verify medical information with a qualified professional/)).toBeInTheDocument();
  });
});
