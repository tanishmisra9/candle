import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { configureAxe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

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
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: { div: MotionDiv, p: MotionP },
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
