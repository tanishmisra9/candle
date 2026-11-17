import { readFileSync } from "node:fs";
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
      expect(within(conversation).getByText(/couldn’t complete that answer/i)).toBeInTheDocument();
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
    await waitFor(() => expect(within(conversation).getByText(/couldn’t complete that answer/i)).toBeInTheDocument());
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
    await waitFor(() => expect(within(conversation).getByText(/couldn’t complete that answer/i)).toBeInTheDocument());
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
    expect(within(conversation).queryByText(/couldn’t complete that answer/i)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe("the empty state", () => {
  const STARTERS = [
    "What are researchers currently testing for choroideremia?",
    "Which gene therapy trials are currently recruiting?",
    "What does the research say about how CHM progresses over time?",
    "Are there any completed Phase 3 CHM trials?",
  ];

  it("offers the same four plain-language starters every time (it used to pick 4 random of 20, some jargon)", () => {
    const first = render(<AskPanel />);
    const read = () =>
      within(screen.getByRole("log", { name: "Conversation" })).getAllByRole("button").map((b) => b.textContent);
    expect(read()).toEqual(STARTERS);
    first.unmount();
    render(<AskPanel />);
    expect(read()).toEqual(STARTERS);
  });

  it("says what Ask cannot do before the first question, instead of on the first refusal", () => {
    render(<AskPanel />);
    expect(screen.getByText(/can’t give medical advice, say which trial suits you, or predict outcomes/)).toBeInTheDocument();
    expect(screen.getByText("Not medical advice. AI can make mistakes.")).toBeInTheDocument();
  });

  it("shows the release number beside the note under the composer (Ask has no footer)", () => {
    // Read package.json directly, not the build's constant, so a hardcoded string fails (same as Footer.test).
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    render(<AskPanel />);
    expect(screen.getByText(`Version ${version}`)).toBeInTheDocument();
  });

  it("limits the question to what the server accepts", () => {
    render(<AskPanel />);
    expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveAttribute("maxlength", "2000");
  });

  it("returns focus to the box after a starter is clicked with a mouse-like pointer (the starter unmounts)", async () => {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, _h, signal) => {
      await new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    });
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("pointer: fine") })) as typeof window.matchMedia;
    try {
      render(<AskPanel />);
      fireEvent.click(screen.getByRole("button", { name: STARTERS[0] }));
      expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveFocus();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("the composer bar", () => {
  it("lines up with the page: shell content width, no extra side padding, a top hairline", () => {
    render(<AskPanel />);
    const bar = screen.getByLabelText(/ask a question about chm trials/i).closest("form") as HTMLElement;
    expect(bar.className).toContain("border-t"); // answer text used to be cut off by an invisible edge
    expect(bar.firstElementChild?.className).toContain("max-w-[1280px]"); // the shell's 1360px minus its 40px gutters
    const box = bar.firstElementChild?.lastElementChild as HTMLElement; // the box around the input row (the Input itself also has py-3)
    expect(box.contains(bar.querySelector("input"))).toBe(true);
    expect(box.className).toContain("py-3");
    expect(box.className).not.toMatch(/(^|\s)p-3|md:p-4/); // vertical padding only: the input starts where the heading starts
  });

  it("makes Send and Stop as tall as the input (50px against 44px)", async () => {
    render(<AskPanel />);
    const send = screen.getByRole("button", { name: "Send question" });
    expect(send.className).toContain("h-full");
    expect(send.parentElement?.className).toContain("self-stretch");
  });
});

describe("describeAskFailure", () => {
  it.each([
    ["Rate limit exceeded for this endpoint.", /too many requests/i],
    ["Ask request timed out.", /took too long/i],
    ["AI service temporarily unavailable", /service is busy/i],
    ["Request body too large", /question was too long/i],
    ["boom", /couldn’t complete that answer just now\. please try again/i],
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
  // `second` is the stream for a retry; leave it out when the test never asks again (a queued mockImplementationOnce
  // that nobody consumes would be picked up by the next test's stream).
  async function failThen(second?: (h: Handlers) => Promise<void>) {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) =>
      (handlers as Handlers).onError("Ask request timed out.", "server"),
    );
    if (second) {
      vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) => second(handlers as Handlers));
    }
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
    const { conversation } = await failThen();
    fireEvent.click(within(conversation).getByRole("button", { name: "Edit question" }));
    expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveValue("What trials are recruiting?");
    expect(within(conversation).queryByText("Answer failed")).not.toBeInTheDocument();
  });

  it("never overwrites a draft the reader has started: 'Edit question' is not offered, and 'Try again' keeps the draft", async () => {
    const { conversation } = await failThen(async (h) => h.onDone({ answer: "Second try worked.", sources: [] }));
    const box = screen.getByLabelText(/ask a question about chm trials/i);
    fireEvent.change(box, { target: { value: "my next question" } });

    expect(within(conversation).queryByRole("button", { name: "Edit question" })).not.toBeInTheDocument();
    fireEvent.click(within(conversation).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(conversation).getByText("Second try worked.")).toBeInTheDocument());
    expect(box).toHaveValue("my next question");
  });
});

describe("waiting and Stop", () => {
  async function pendingStream(first?: (h: Handlers) => void) {
    const api = await import("../lib/api");
    vi.mocked(api.askQuestion).mockReset();
    const seen: { signal?: AbortSignal } = {};
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers, signal) => {
      seen.signal = signal;
      first?.(handlers as Handlers);
      // A stream that stays open until it is aborted, as the real fetch does.
      await new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      );
    });
    render(<AskPanel />);
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    return { api, seen, conversation: screen.getByRole("log", { name: "Conversation" }) };
  }

  it("says what is happening while waiting for the first token", async () => {
    const { conversation } = await pendingStream();
    expect(await within(conversation).findByText("Searching trials and papers…")).toBeInTheDocument();
  });

  it("keeps the icon buttons' padding off, or the variant's px-5 squeezes the icon to ~2px inside the 44px square", async () => {
    await pendingStream();
    expect(screen.getByRole("button", { name: "Stop answer" }).className).toContain("!p-0");
  });

  it("Stop and Send are different elements (one reused button turned into a submit mid-click and re-asked the stopped question)", async () => {
    const { api, conversation } = await pendingStream();
    await within(conversation).findByTestId("loading-dots");
    const stop = screen.getByRole("button", { name: "Stop answer" });
    expect(stop).toHaveAttribute("type", "button");
    const callsBefore = vi.mocked(api.askQuestionStream).mock.calls.length; // the spy is shared across tests
    fireEvent.click(stop);
    const send = await screen.findByRole("button", { name: "Send question" });
    expect(send).not.toBe(stop);
    expect(vi.mocked(api.askQuestionStream).mock.calls.length).toBe(callsBefore);
  });

  it("Stop before any text hands the question back to the box and sends no fallback request", async () => {
    const { api, seen, conversation } = await pendingStream();
    await within(conversation).findByTestId("loading-dots");
    fireEvent.click(screen.getByRole("button", { name: "Stop answer" }));
    expect(seen.signal?.aborted).toBe(true); // the request really stops, not just the display

    await waitFor(() => expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveValue("What trials are recruiting?"));
    expect(within(conversation).queryByTestId("loading-dots")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("What trials are recruiting?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send question" })).toBeInTheDocument();
    expect(api.askQuestion).not.toHaveBeenCalled(); // no second, paid request for an answer the reader walked away from
  });

  it("Stop before any text never overwrites a draft the reader has started, and leaves their question visible", async () => {
    const { conversation } = await pendingStream();
    await within(conversation).findByTestId("loading-dots");
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), { target: { value: "my next question" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop answer" }));

    await waitFor(() => expect(within(conversation).queryByTestId("loading-dots")).not.toBeInTheDocument());
    expect(screen.getByLabelText(/ask a question about chm trials/i)).toHaveValue("my next question");
    expect(within(conversation).getByText("What trials are recruiting?")).toBeInTheDocument(); // not lost
  });

  it("Stop also cancels the fallback request a broken stream started (it would run to completion on the server)", async () => {
    const api = await import("../lib/api");
    let fallbackSignal: AbortSignal | undefined;
    vi.mocked(api.askQuestion).mockReset();
    vi.mocked(api.askQuestion).mockImplementationOnce((_q, signal) => {
      fallbackSignal = signal;
      return new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      );
    });
    vi.mocked(api.askQuestionStream).mockImplementationOnce(async (_q, handlers) =>
      (handlers as Handlers).onError("network error", "transport"),
    );
    render(<AskPanel />);
    fireEvent.change(screen.getByLabelText(/ask a question about chm trials/i), {
      target: { value: "What trials are recruiting?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(api.askQuestion).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Stop answer" }));
    expect(fallbackSignal?.aborted).toBe(true);
  });

  it("Stop after some text keeps what was streamed and marks it stopped", async () => {
    const { api, seen, conversation } = await pendingStream((h) => h.onDelta("Two trials are "));
    await within(conversation).findByText(/Two trials are/);
    fireEvent.click(screen.getByRole("button", { name: "Stop answer" }));
    expect(seen.signal?.aborted).toBe(true);

    expect(await within(conversation).findByText("Stopped.")).toBeInTheDocument();
    expect(within(conversation).getByText(/Two trials are/)).toBeInTheDocument();
    expect(api.askQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send question" })).toBeInTheDocument();
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

describe("Ask failure copy typography", () => {
  it("uses the curly apostrophe like the rest of the product (it was the one straight one)", () => {
    for (const raw of ["boom", "Ask request timed out.", "AI service temporarily unavailable", "Request body too large"]) {
      const { text } = describeAskFailure(raw);
      expect(text).toContain("couldn’t");
      expect(text).not.toContain("'");
    }
  });
});
