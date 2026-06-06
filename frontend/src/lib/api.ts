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

type AskStreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: (payload: AskResponse) => void;
  onError: (message: string) => void;
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
    handlers.onError(errorText || `Request failed with ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) {
        continue;
      }

      const payload = JSON.parse(dataLine.slice(6)) as
        | { type: "delta"; delta: string }
        | { type: "done"; answer: string; sources: AskResponse["sources"] }
        | { type: "error"; detail: string };

      if (payload.type === "delta") {
        handlers.onDelta(payload.delta);
      } else if (payload.type === "done") {
        handlers.onDone({ answer: payload.answer, sources: payload.sources });
      } else if (payload.type === "error") {
        handlers.onError(payload.detail);
      }
    }
  }
}
