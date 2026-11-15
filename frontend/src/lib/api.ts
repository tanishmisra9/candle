/**
 * The only API client boundary. `VITE_API_BASE_URL` (default `http://localhost:8000`) is the backend origin.
 *
 * `askQuestionStream` reads the `/ask/stream` SSE frames (`delta`, `done`, `error`); the `done` payload is authoritative and replaces any streamed text. List endpoints return a cursor envelope (`items`, `next_cursor`, `total`) when `envelope=true` or a cursor is sent.
 */
import type {
  AskResponse,
  CursorPage,
  PublicationSummary,
  SyncStatus,
  TrialDetail,
  TrialSummary,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type QueryParamValue = string | number | boolean | undefined | string[];

function buildSearchParams(params: Record<string, QueryParamValue>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) {
          search.append(key, entry);
        }
      });
      return;
    }
    search.set(key, String(value));
  });
  return search;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listTrials(params: Record<string, QueryParamValue>) {
  return request<TrialSummary[]>(`/trials?${buildSearchParams(params).toString()}`);
}

export async function listTrialsPage(params: Record<string, QueryParamValue>) {
  return request<CursorPage<TrialSummary>>(`/trials?${buildSearchParams(params).toString()}`);
}

export async function getTrial(id: string) {
  return request<TrialDetail>(`/trials/${id}`);
}

export async function listPublications(params: Record<string, QueryParamValue>) {
  return request<PublicationSummary[]>(
    `/publications?${buildSearchParams(params).toString()}`,
  );
}

export async function listPublicationsPage(params: Record<string, QueryParamValue>) {
  return request<CursorPage<PublicationSummary>>(
    `/publications?${buildSearchParams(params).toString()}`,
  );
}

export async function getSyncLastSynced() {
  return request<SyncStatus>("/sync/last-synced");
}

export async function getPublicationOverview(pmid: string) {
  const controller = new AbortController();
  let timeout = 0;
  const fetchPromise = request<{ overview: string | null }>(`/publications/${pmid}/overview`, {
    method: "POST",
    signal: controller.signal,
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => {
      controller.abort();
      reject(new Error("Publication overview request timed out."));
    }, 12_000);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function askQuestion(question: string) {
  return request<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

/**
 * Why an answer stream failed. "server": the backend refused or reported a failure (rate limit, too
 * long, timeout, provider outage...), so asking again would just repeat it. "transport": the stream
 * itself broke (dropped connection, proxy cut, garbled data), which a plain non-streaming request may
 * get around.
 */
export type AskStreamErrorKind = "server" | "transport";

type AskStreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: (payload: AskResponse) => void;
  onError: (message: string, kind: AskStreamErrorKind) => void;
};

export async function askQuestionStream(
  question: string,
  handlers: AskStreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE}/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    handlers.onError(errorText || `Request failed with ${response.status}`, "server");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // The stream is only complete once a `done` (or `error`) event has been handled. A proxy cutting
  // the connection, a dropped network or a backend crash can all end it without either, and the
  // caller must still hear about that exactly once (otherwise the answer sits "generating" forever).
  let finished = false;
  // True once one of the caller's own handlers has thrown. That is the caller's bug, not a broken
  // stream: it must reach the caller as-is and never be reported through `onError` (which made the
  // panel start a duplicate, paid request, or replace a finished answer with a failure message).
  let handlerThrew = false;
  const callHandler = (call: () => void) => {
    try {
      call();
    } catch (error) {
      handlerThrew = true;
      throw error;
    }
  };

  const handle = (event: string) => {
    const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
    if (!dataLine) {
      return;
    }

    const payload = JSON.parse(dataLine.slice(6)) as
      | { type: "delta"; delta: string }
      | { type: "done"; answer: string; sources: AskResponse["sources"] }
      | { type: "error"; detail: string };

    if (payload.type === "delta") {
      callHandler(() => handlers.onDelta(payload.delta));
    } else if (payload.type === "done") {
      finished = true;
      callHandler(() => handlers.onDone({ answer: payload.answer, sources: payload.sources }));
    } else if (payload.type === "error") {
      finished = true;
      callHandler(() => handlers.onError(payload.detail, "server"));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        handle(event);
      }
    }
    // A last event that arrived without its trailing blank line.
    if (buffer.trim()) {
      handle(buffer);
    }
  } catch (error) {
    // A deliberate abort (a new question, leaving the page) is not a failure to report. An error
    // thrown by one of the caller's own handlers is the caller's bug: surface it, do not report it.
    if (signal?.aborted || finished || handlerThrew) {
      throw error;
    }
    finished = true;
    handlers.onError(error instanceof Error ? error.message : "The answer stream was interrupted.", "transport");
    return;
  }

  // A deliberate abort can also end the read cleanly: that is not a failure to report (reporting it
  // made the caller start a duplicate, paid, non-streaming request for a question already abandoned).
  if (!finished && !signal?.aborted) {
    handlers.onError("The answer stream ended before the answer was complete.", "transport");
  }
}
