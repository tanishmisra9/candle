import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrialSnapshot } from "./TrialSnapshot";
import type { TrialDetail } from "../types";


const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../lib/mobile", () => ({
  useIsMobile: () => false,
  useScrolledPastThreshold: () => false,
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
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
      p: MotionP,
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
