import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutView } from "./AboutView";

describe("AboutView", () => {
  it("has one h1 and both sections", () => {
    render(<AboutView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "What Candle does, and what it doesn’t" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "A note from the builder" })).toBeInTheDocument();
  });

  it("is honest about limits: no medical advice, AI can be wrong", () => {
    render(<AboutView />);
    expect(screen.getByText(/does not give medical advice/i)).toBeInTheDocument();
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
