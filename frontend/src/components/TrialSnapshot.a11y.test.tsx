import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { configureAxe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrialDetail } from "../types";
import { TrialSnapshot } from "./TrialSnapshot";

const mockUseQuery = vi.fn();
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../lib/mobile", () => ({
  useIsMobile: () => false,
  useScrolledPastThreshold: () => false,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  type MockMotionDivProps = React.HTMLAttributes<HTMLDivElement> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    layout?: boolean;
    transition?: unknown;
  };
  type MockMotionPProps = React.HTMLAttributes<HTMLParagraphElement> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
  };
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, MockMotionDivProps>(
    ({ animate: _animate, exit: _exit, initial: _initial, layout: _layout, transition: _transition, children, ...props }, ref) => (
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
    locations: [{ city: "Boston", country: "United States", facility: "Mass Eye and Ear" }],
    contact_email: null,
    url: "https://clinicaltrials.gov/study/NCT12345678",
    ai_summary: "A pre-generated overview for this trial.",
    publications: [],
    outcomes: [],
    ...overrides,
  };
}

function TrialSnapshotHarness() {
  const [trialId, setTrialId] = useState<string | null>(null);

  return (
    <>
      <button type="button" onClick={() => setTrialId("NCT12345678")}>
        Open trial
      </button>
      <TrialSnapshot
        trialId={trialId}
        onClose={() => setTrialId(null)}
        onOpenPublicationSnapshot={() => {}}
        isPublicationSnapshotOpen={false}
        publicationSnapshotLayer="below-trial"
      />
    </>
  );
}

describe("TrialSnapshot accessibility", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders an accessible dialog, announces opening, and restores focus", async () => {
    mockUseQuery.mockReturnValue({
      data: makeTrialDetail(),
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<TrialSnapshotHarness />);

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");

    const trigger = screen.getByRole("button", { name: "Open trial" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Example CHM Trial" });
    const results = await axe(document.body);

    expect(results.violations).toHaveLength(0);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("heading", { name: "Example CHM Trial" })).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Example CHM Trial details opened");

    await user.click(screen.getByRole("button", { name: /close trial details/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(liveRegion).toHaveTextContent("");
  });

  it("keeps the dialog labeled and focusable while details are loading", async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const user = userEvent.setup();
    render(<TrialSnapshotHarness />);

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    const trigger = screen.getByRole("button", { name: "Open trial" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Loading trial details" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("heading", { name: "Loading trial details" })).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Trial details opened");
  });
});
