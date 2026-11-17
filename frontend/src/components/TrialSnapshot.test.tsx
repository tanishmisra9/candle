import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrialSnapshot } from "./TrialSnapshot";
import type { TrialDetail } from "../types";


const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("../lib/mobile", () => ({
  useIsMobile: () => viewport.mobile,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );
  const MotionP = ReactModule.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => (
      <p ref={ref} {...props}>
        {children}
      </p>
    ),
  );
  type MockMotionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    whileTap?: unknown;
  };
  const MotionButton = ReactModule.forwardRef<HTMLButtonElement, MockMotionButtonProps>(
    ({ whileTap: _whileTap, children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    ),
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
      p: MotionP,
      button: MotionButton,
    },
    useReducedMotion: () => false,
  };
});


function makeTrialDetail(overrides: Partial<TrialDetail> = {}): TrialDetail {
  return {
    id: "NCT12345678",
    title: "Example CHM Trial",
    status: "RECRUITING",
    phase: "PHASE2",
    start_date: null,
    completion_date: null,
    sponsor: "Candle",
    intervention: "Gene therapy",
    intervention_type: "GENETIC",
    enrollment: 12,
    primary_endpoint: "BCVA",
    locations: [],
    contact_email: null,
    url: "https://clinicaltrials.gov/study/NCT12345678",
    ai_summary: null,
    publications: [],
    outcomes: [],
    ...overrides,
  };
}


describe("TrialSnapshot AI summary", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("shows a loading state while the detail query is fetching", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );

    expect(screen.getByText("AI SUMMARY")).toBeInTheDocument();
    expect(screen.getByText("Loading summary…")).toBeInTheDocument();
    expect(screen.getByText("Loading trial details…")).toBeInTheDocument();
  });

  it("shows a fallback when the stored summary is empty", () => {
    mockUseQuery.mockReturnValue({
      data: makeTrialDetail({ ai_summary: "   " }),
      isLoading: false,
    });

    render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );

    expect(screen.getByText("No summary available.")).toBeInTheDocument();
  });

  it("renders the stored AI summary when present", () => {
    mockUseQuery.mockReturnValue({
      data: makeTrialDetail({ ai_summary: "A pre-generated overview for this trial." }),
      isLoading: false,
    });

    render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );

    expect(screen.getByText("A pre-generated overview for this trial.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Written by AI from the ClinicalTrials.gov record, so it can contain mistakes. Always verify medical information with a qualified professional.",
      ),
    ).toBeInTheDocument();
  });
});

describe("TrialSnapshot scrolling on a phone", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    viewport.mobile = true;
  });
  afterEach(() => {
    viewport.mobile = false;
  });

  it("does not resize the header while the content scrolls (it shrank 155px -> 102px mid-scroll and the content jumped under the finger)", () => {
    mockUseQuery.mockReturnValue({ data: makeTrialDetail(), isLoading: false });
    render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );
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

    expect(title.className).toContain("text-[26px]"); // the expanded size, always
    expect(title.className).not.toContain("text-[21px]");
    expect(header.getAttribute("style")).toBeNull(); // no animated padding
  });

  it("keeps a drag at the end of the content from chaining to the overlay or the page behind it", () => {
    mockUseQuery.mockReturnValue({ data: makeTrialDetail(), isLoading: false });
    render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );
    const dialog = screen.getByRole("dialog");
    const scroller = screen.getByTestId("snapshot-scroll");
    expect(scroller.className).toContain("overscroll-contain");
    expect(dialog.parentElement!.className).toContain("overscroll-contain"); // the overlay around the panel
  });
});

describe("TrialSnapshot page scroll lock", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({ data: makeTrialDetail(), isLoading: false });
  });

  it("locks <html> and <body> while open and releases both when it closes", () => {
    const props = {
      onClose: () => {},
      onOpenPublicationSnapshot: () => {},
      isPublicationSnapshotOpen: false,
      publicationSnapshotLayer: "below-trial" as const,
    };
    const { rerender } = render(<TrialSnapshot trialId="NCT12345678" {...props} />);
    expect([document.documentElement.style.overflow, document.body.style.overflow]).toEqual(["hidden", "hidden"]);
    rerender(<TrialSnapshot trialId={null} {...props} />);
    expect([document.documentElement.style.overflow, document.body.style.overflow]).toEqual(["", ""]);
  });
});

describe("TrialSnapshot facts", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  function open(overrides: Parameters<typeof makeTrialDetail>[0] = {}) {
    mockUseQuery.mockReturnValue({ data: makeTrialDetail(overrides), isLoading: false });
    return render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={() => {}}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />,
    );
  }

  it("shows status, phase, sponsor and participants at the top, as the card does", () => {
    open();
    expect(screen.getByText("Recruiting")).toBeInTheDocument();
    expect(screen.getByText("Phase 2")).toBeInTheDocument();
    expect(screen.getByText("Candle · 12 participants")).toBeInTheDocument();
  });

  it("says what is missing instead of 'to Unknown'", () => {
    open({ start_date: "2011-12-01", completion_date: null });
    expect(screen.getByText(/Started .*2011 · no end date reported/)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
  });

  it("names the countries of the sites, not just a count", () => {
    open({ locations: [{ country: "Canada" }, { country: "Germany" }, { country: "Canada" }] });
    expect(screen.getByText("3 sites in Canada, Germany")).toBeInTheDocument();
  });

  it("prints a site's status in the same words as everywhere else, not the raw API value ('RECRUITING')", () => {
    open({ locations: [{ facility: "Moorfields", city: "London", country: "United Kingdom", status: "ACTIVE_NOT_RECRUITING" }] });
    expect(screen.getByText("Active Not Recruiting")).toBeInTheDocument();
    expect(screen.queryByText("ACTIVE_NOT_RECRUITING")).not.toBeInTheDocument();
  });

  it("shows the first three outcomes and opens the rest on request (a trial can list 19: the dialog was ~5,000px)", () => {
    const outcomes = Array.from({ length: 7 }, (_, i) => ({
      outcome_type: i === 0 ? "primary" : "secondary", measure: `Measure ${i + 1}`, timeframe: null, description: `Details ${i + 1}`,
    }));
    open({ outcomes });
    expect(screen.getByText("Measure 1")).toBeInTheDocument(); // the primary outcome comes first
    expect(screen.getByText("Measure 3")).toBeInTheDocument();
    expect(screen.queryByText("Measure 4")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Show 4 more outcomes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("Measure 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show fewer outcomes" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show fewer outcomes" }));
    expect(screen.queryByText("Measure 4")).not.toBeInTheDocument();
  });

  it("has no toggle when there are three outcomes or fewer", () => {
    open({ outcomes: [{ outcome_type: "primary", measure: "Only one", timeframe: null, description: null }] });
    expect(screen.queryByRole("button", { name: /outcome/i })).not.toBeInTheDocument();
  });

  it("makes the contact email a mailto link", () => {
    open({ contact_email: "study@example.org" });
    expect(screen.getByRole("link", { name: "study@example.org" })).toHaveAttribute(
      "href",
      "mailto:study@example.org",
    );
  });

  it("repeats the full title in the body on a phone, hidden from assistive tech", () => {
    viewport.mobile = true;
    try {
      const { container } = open();
      const copy = container.ownerDocument.querySelector('p[aria-hidden="true"]');
      expect(copy?.textContent).toBe("Example CHM Trial");
    } finally {
      viewport.mobile = false;
    }
  });
});

describe("TrialSnapshot stacked on a paper", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({ data: makeTrialDetail(), isLoading: false });
  });

  function open(underneath?: string, onClose = () => {}) {
    return render(
      <TrialSnapshot
        trialId="NCT12345678"
        onClose={onClose}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={Boolean(underneath)}
        publicationSnapshotLayer="below-trial"
        underneath={underneath}
      />,
    );
  }

  it("names what is underneath and closes itself when 'Back to' is pressed", () => {
    const onClose = vi.fn();
    open("paper 777", onClose);
    fireEvent.click(screen.getByRole("button", { name: "Back to paper 777" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog panel positioned, so sr-only text inside it cannot make the fixed overlay scrollable", () => {
    open();
    // sr-only is position:absolute; in an unpositioned panel it escapes overflow-hidden and lands wherever the flow puts it,
    // which with enough content above it is below the overlay (axe: scrollable-region-focusable on the overlay).
    expect(screen.getByRole("dialog").className).toContain("relative");
  });

  it("shows no Back button when nothing is underneath", () => {
    open();
    expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
  });
});
