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

    expect(screen.getByText("OVERVIEW")).toBeInTheDocument();
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
        "This is AI-generated. Always verify medical information with a qualified professional.",
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
