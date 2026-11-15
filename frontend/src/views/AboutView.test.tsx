import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutView } from "./AboutView";

describe("AboutView", () => {
  it("has one h1 and the three sections", () => {
    render(<AboutView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of ["What Candle does", "What Candle doesn’t do", "A note from the builder"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("puts the no-medical-advice limit under 'doesn't do', not under 'does'", () => {
    render(<AboutView />);
    const doesnt = screen.getByRole("region", { name: "What Candle doesn’t do" });
    expect(within(doesnt).getByText(/does not give medical advice/i)).toBeInTheDocument();
    expect(within(doesnt).getByText(/talk with your care team/i)).toBeInTheDocument();
    const does = screen.getByRole("region", { name: "What Candle does" });
    expect(within(does).queryByText(/medical advice/i)).not.toBeInTheDocument();
    expect(within(does).getByText(/only reports what is documented/i)).toBeInTheDocument();
  });

  it("is honest that AI-written summaries can be wrong", () => {
    render(<AboutView />);
    expect(screen.getByText(/written by AI\. They can contain mistakes/i)).toBeInTheDocument();
  });

  it("marks the external link as opening in a new tab for screen readers", () => {
    render(<AboutView />);
    const link = screen.getByRole("link", { name: /CureCHM/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });
});
