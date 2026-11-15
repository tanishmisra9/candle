import { afterEach, describe, expect, it, vi } from "vitest";

import { askQuestionStream } from "./api";

// A fetch whose body streams the given chunks, then either closes or fails.
function streamingFetch(chunks: string[], end: "close" | Error = "close") {
  const encoder = new TextEncoder();
  let i = 0;
  const body = {
    getReader: () => ({
      read: async () => {
        if (i < chunks.length) return { done: false, value: encoder.encode(chunks[i++]) };
        if (end === "close") return { done: true, value: undefined };
        throw end;
      },
    }),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));
}

const frame = (payload: object) => `data: ${JSON.stringify(payload)}\n\n`;
const handlers = () => ({ onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() });

afterEach(() => vi.unstubAllGlobals());

describe("askQuestionStream completion", () => {
  it("a normal stream ends with one done and no error", async () => {
    streamingFetch([frame({ type: "delta", delta: "Hi" }), frame({ type: "done", answer: "Hi", sources: [] })]);
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onDelta).toHaveBeenCalledWith("Hi");
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("a stream that closes without done or error reports exactly one error (it used to hang forever)", async () => {
    streamingFetch([frame({ type: "delta", delta: "partial" })]);
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledTimes(1);
  });

  it("a read that fails mid-stream (dropped connection) reports one error", async () => {
    streamingFetch([frame({ type: "delta", delta: "partial" })], new TypeError("network error"));
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("network error", "transport");
  });

  it("an error event is reported once and the clean close after it adds nothing", async () => {
    streamingFetch([frame({ type: "error", detail: "boom" })]);
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("boom", "server");
  });

  it("a final event without its trailing blank line is still handled", async () => {
    streamingFetch([`data: ${JSON.stringify({ type: "done", answer: "A", sources: [] })}`]);
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("an abort that ends the read cleanly (no throw) is not reported either", async () => {
    const controller = new AbortController();
    streamingFetch([frame({ type: "delta", delta: "partial" })]); // closes cleanly
    controller.abort();
    const h = handlers();
    await askQuestionStream("q", h, controller.signal);
    expect(h.onError).not.toHaveBeenCalled(); // used to start a duplicate non-streaming request
  });

  it("a deliberate abort is not reported as an error", async () => {
    const controller = new AbortController();
    controller.abort();
    streamingFetch([], new DOMException("aborted", "AbortError"));
    const h = handlers();
    await expect(askQuestionStream("q", h, controller.signal)).rejects.toThrow();
    expect(h.onError).not.toHaveBeenCalled();
  });
});

describe("askQuestionStream error kinds (what a retry can fix)", () => {
  it("a stream that ends without done is a transport failure (a plain request may get around it)", async () => {
    streamingFetch([frame({ type: "delta", delta: "partial" })]);
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onError).toHaveBeenCalledWith(expect.any(String), "transport");
  });

  it("a non-OK response (rate limit, too long...) is a server failure: a retry would repeat it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, body: null, text: async () => "Rate limit exceeded" }),
    );
    const h = handlers();
    await askQuestionStream("q", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("Rate limit exceeded", "server");
  });
});

describe("askQuestionStream when the caller's own handler throws", () => {
  it("a throwing onDelta reaches the caller as-is and is NOT reported as a stream failure", async () => {
    // It used to be reported through onError, which made the panel start a duplicate paid request.
    streamingFetch([frame({ type: "delta", delta: "x" }), frame({ type: "done", answer: "x", sources: [] })]);
    const h = handlers();
    h.onDelta.mockImplementation(() => {
      throw new Error("setState blew up");
    });
    await expect(askQuestionStream("q", h)).rejects.toThrow("setState blew up");
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled();
  });

  it("a throwing onDone also reaches the caller, and onError is never called after a finished stream", async () => {
    streamingFetch([frame({ type: "done", answer: "x", sources: [] })]);
    const h = handlers();
    h.onDone.mockImplementation(() => {
      throw new Error("render failed");
    });
    await expect(askQuestionStream("q", h)).rejects.toThrow("render failed");
    expect(h.onError).not.toHaveBeenCalled();
  });
});
