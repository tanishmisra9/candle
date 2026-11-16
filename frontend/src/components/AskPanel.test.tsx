import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AskPanel, describeAskFailure } from "./AskPanel";

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

type Handlers = {
  onDelta: (delta: string) => void;
  onDone: (payload: { answer: string; sources: [] }) => void;
  onError: (message: string, kind: "server" | "transport") => void;
};

async function askWith(stream: (handlers: Handlers) => Promise<void>) {
  const api = await import("../lib/api");
  vi.mocked(api.askQuestion).mockReset();
  vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) => stream(handlers as Handlers));
  render(<AskPanel />);
  fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
    target: { value: "What trials are recruiting?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
  return { api, conversation: screen.getByRole("log", { name: "Conversation" }) };
}

describe("AskPanel failures do not trigger a second, paid request unless a retry can help", () => {
  it("an error the server reported after text had streamed is shown, with no fallback request", async () => {
    const { api, conversation } = await askWith(async (h) => {
      h.onDelta("Partial ");
      h.onError("Ask request timed out.", "server");
    });
    await waitFor(() => expect(within(conversation).getByText(/couldn't complete that answer/i)).toBeInTheDocument());
    expect(api.askQuestion).not.toHaveBeenCalled();
  });

  it("an error the server reported before any text (rate limit) is shown as such, with no fallback request", async () => {
    const { api, conversation } = await askWith(async (h) => h.onError("Rate limit exceeded for this endpoint.", "server"));
    await waitFor(() => expect(within(conversation).getByText(/too many requests/i)).toBeInTheDocument());
    expect(api.askQuestion).not.toHaveBeenCalled();
  });

  it("a stream that broke before any text falls back to one plain request, which fills in the answer", async () => {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestion).mockReset();
    vi.mocked(api.askQuestion).mockResolvedValue({ answer: "Fallback answer.", sources: [] });
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) =>
      (handlers as Handlers).onError("network error", "transport"),
    );
    render(<AskPanel />);
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    const conversation = screen.getByRole("log", { name: "Conversation" });
    await waitFor(() => expect(within(conversation).getByText("Fallback answer.")).toBeInTheDocument());
    expect(api.askQuestion).toHaveBeenCalledTimes(1);
  });

  it("a stream that breaks AFTER text streamed does not retry (it would repeat a question already paid for)", async () => {
    const { api, conversation } = await askWith(async (h) => {
      h.onDelta("Partial ");
      h.onError("The answer stream ended before the answer was complete.", "transport");
    });
    await waitFor(() => expect(within(conversation).getByText(/couldn't complete that answer/i)).toBeInTheDocument());
    expect(api.askQuestion).not.toHaveBeenCalled();
  });

  it("a rejection that arrives after the answer finished does not replace the answer with a failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { conversation } = await askWith(async (h) => {
      h.onDone({ answer: "Finished answer.", sources: [] });
      throw new Error("a handler threw after done");
    });
    await waitFor(() => expect(within(conversation).getByText("Finished answer.")).toBeInTheDocument());
    await waitFor(() => expect(consoleError).toHaveBeenCalled()); // it is logged, not shown
    expect(within(conversation).queryByText(/couldn't complete that answer/i)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe("describeAskFailure", () => {
  it.each([
    ["Rate limit exceeded for this endpoint.", /too many requests/i],
    ["Ask request timed out.", /took too long/i],
    ["AI service temporarily unavailable", /service is busy/i],
    ["Request body too large", /question was too long/i],
    ["boom", /couldn't complete that answer just now\. please try again/i],
  ])("%s", (raw, expected) => {
    expect(describeAskFailure(raw).text).toMatch(expected);
  });

  it("never tells a visitor to check an API key outside development", () => {
    vi.stubEnv("DEV", false);
    try {
      expect(describeAskFailure("boom").text).not.toMatch(/openai|backend/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("a failed answer keeps the question and offers a way forward", () => {
  async function failThen(second: (h: Handlers) => Promise<void>) {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestionStream)
      .mockImplementationOnce(async (_q, handlers) => (handlers as Handlers).onError("Ask request timed out.", "server"))
      .mockImplementationOnce(async (_q, handlers) => second(handlers as Handlers));
    render(<AskPanel />);
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    const conversation = screen.getByRole("log", { name: "Conversation" });
    await waitFor(() => expect(within(conversation).getByText("Answer failed")).toBeInTheDocument());
    return { api, conversation };
  }

  it("'Try again' asks the same question again and replaces the failed pair (no duplicate question)", async () => {
    const { api, conversation } = await failThen(async (h) => h.onDone({ answer: "Second try worked.", sources: [] }));
    fireEvent.click(within(conversation).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(conversation).getByText("Second try worked.")).toBeInTheDocument());
    expect(within(conversation).getAllByText("What trials are recruiting?")).toHaveLength(1);
    expect(within(conversation).queryByText("Answer failed")).not.toBeInTheDocument();
    expect(vi.mocked(api.askQuestionStream).mock.calls.at(-1)?.[0]).toBe("What trials are recruiting?");
  });

  it("'Edit question' puts the text back in the box instead of losing it", async () => {
    const { conversation } = await failThen(async () => {});
    fireEvent.click(within(conversation).getByRole("button", { name: "Edit question" }));
    expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveValue("What trials are recruiting?");
    expect(within(conversation).queryByText("Answer failed")).not.toBeInTheDocument();
  });
});

describe("scrollToBottom (the follow-the-stream guard)", () => {
  function pageAt(y: number, bottom: number) {
    let current = y;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => current });
    window.scrollTo = vi.fn((_x: number, to: number) => {
      current = Math.min(to, bottom); // the browser clamps to the real bottom
    }) as unknown as typeof window.scrollTo;
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: bottom });
  }

  it("arms the guard with the new position when the page really moved", async () => {
    const { scrollToBottom } = await import("./AskPanel");
    pageAt(0, 500);
    const guard = { current: null as number | null };
    scrollToBottom(guard);
    expect(guard.current).toBe(500);
  });

  it("leaves the guard OFF when the page was already at the bottom (no scroll event will clear it)", async () => {
    const { scrollToBottom } = await import("./AskPanel");
    pageAt(500, 500);
    const guard = { current: 123 as number | null };
    scrollToBottom(guard);
    expect(guard.current).toBeNull(); // an armed guard here swallowed the user's next small scroll
  });
});
