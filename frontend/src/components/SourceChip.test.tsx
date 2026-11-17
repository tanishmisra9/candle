import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AskSource } from "../types";
import { SourceChip } from "./SourceChip";

const trial: AskSource = {
  source_type: "trial",
  source_id: "NCT03496012",
  title: "Efficacy and Safety of BIIB111 for the Treatment of Choroideremia",
  label: "NCT03496012",
  detail: "COMPLETED · PHASE3",
  url: null,
};

describe("SourceChip", () => {
  it("is compact: tight padding and line height, 44px high (it was ~56px and 22rem wide and read as fat)", () => {
    render(<SourceChip source={trial} onOpenTrialSnapshot={() => {}} />);
    const chip = screen.getByRole("button");
    expect(chip).toHaveClass("min-h-11", "py-1", "leading-tight");
    expect(chip).not.toHaveClass("py-2");
    expect(chip.parentElement?.className).toContain("sm:max-w-[min(100%,18rem)]");
    expect(chip.parentElement?.className).not.toContain("22rem");
  });

  it("still carries the title and the id/status line, so a phone without a tooltip knows which trial it is", () => {
    render(<SourceChip source={trial} onOpenTrialSnapshot={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Efficacy and Safety of BIIB111");
    expect(screen.getByRole("button")).toHaveTextContent("NCT03496012");
  });
});
