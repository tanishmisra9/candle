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

const streamGate: { release: (() => void) | null } = { release: null };

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
          streamGate.release = () => resolve();
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
    streamGate.release = null;
    render(<AskPanel />);

    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    const conversation = screen.getByRole("log", { name: "Conversation" });

    await waitFor(() => {
      expect(within(conversation).getByTestId("loading-dots")).toBeInTheDocument();
    });
    expect(within(conversation).queryByLabelText("Copy response")).not.toBeInTheDocument();

    streamGate.release?.();

    await waitFor(() => {
      expect(within(conversation).getByText(/Recruiting trials found\./)).toBeInTheDocument();
    });

    expect(within(conversation).queryByTestId("loading-dots")).not.toBeInTheDocument();
  });

  it("announces the finished answer once through a persistent status region, not per delta", async () => {
    streamGate.release = null;
    render(<AskPanel />);
    const region = screen.getByText("", { selector: '[role="status"].sr-only' });

    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(region).toHaveTextContent("Generating answer."));

    streamGate.release?.();
    await waitFor(() => expect(region).toHaveTextContent("Recruiting trials found."));
    // The region is mounted from the start (live regions inserted with text announce unreliably).
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-live", "off");
  });

  it("a stream that blows up still finishes the message and announces the failure (no stuck 'Generating answer.')", async () => {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async () => {
      throw new Error("reader exploded");
    });
    render(<AskPanel />);

    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    const conversation = screen.getByRole("log", { name: "Conversation" });
    await waitFor(() => {
      expect(within(conversation).getByText(/couldn't complete that answer/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("status").some((el) => /Generating answer/.test(el.textContent ?? ""))).toBe(false);
    expect(screen.getAllByRole("status").some((el) => /could not be completed/.test(el.textContent ?? ""))).toBe(true);
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled(); // empty draft, no longer pending
  });

  it("callbacks that arrive after the panel is gone do not start a duplicate fallback request", async () => {
    const api = await import("../lib/api");
    let captured: { onError: (message: string) => void } | null = null;
    vi.mocked(api.askQuestion).mockClear();
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) => {
      captured = handlers as unknown as { onError: (message: string) => void };
      await new Promise<void>(() => {}); // never settles: the user leaves first
    });
    const view = render(<AskPanel />);
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(captured).not.toBeNull());

    view.unmount(); // aborts the in-flight answer
    captured!.onError("stream ended early"); // a late callback, as after an abort that ended the read cleanly

    expect(api.askQuestion).not.toHaveBeenCalled(); // no second, paid request for an abandoned question
  });
});
