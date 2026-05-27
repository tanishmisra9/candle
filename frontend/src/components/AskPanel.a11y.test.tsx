import { render, screen } from "@testing-library/react";
import { configureAxe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { AskPanel } from "./AskPanel";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("AskPanel accessibility", () => {
  it("labels the question field and exposes a named send control", async () => {
    const { container } = render(<AskPanel />);
    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
    expect(
      screen.getByLabelText(/ask a question about chm trials/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send question" })).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
  });
});
