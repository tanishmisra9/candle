import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AskPanel } from "./AskPanel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { last_synced: null },
    isPending: false,
    isError: false,
  }),
}));

let releaseStream: (() => void) | undefined;

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    askQuestion: vi.fn(),
    askQuestionStream: vi.fn(
      async (
        _question: string,
        handlers: {
          onDelta: (delta: string) => void;
          onDone: (payload: { answer: string; sources: [] }) => void;
        },
      ) => {
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
        handlers.onDelta("Recruiting ");
        handlers.onDelta("trials found.");
        handlers.onDone({ answer: "Recruiting trials found.", sources: [] });
      },
    ),
  };
});

describe("AskPanel streaming UI", () => {
  it("hides the loading dots after the first streamed delta arrives", async () => {
    releaseStream = undefined;
    render(<AskPanel />);

    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    const conversation = screen.getByRole("log", { name: "Conversation" });

    await waitFor(() => {
      expect(within(conversation).getByRole("status")).toBeInTheDocument();
    });
    expect(within(conversation).queryByLabelText("Copy response")).not.toBeInTheDocument();

    releaseStream?.();

    await waitFor(() => {
      expect(screen.getByText(/Recruiting trials found\./)).toBeInTheDocument();
    });

    expect(within(conversation).queryByRole("status")).not.toBeInTheDocument();
  });
});
