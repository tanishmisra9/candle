import type {
  AskResponse,
  CursorPage,
  PublicationSummary,
  TrialDetail,
  TrialSummary,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

export async function listTrials(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return request<TrialSummary[]>(`/trials?${search.toString()}`);
}

export async function listTrialsPage(
  params: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return request<CursorPage<TrialSummary>>(`/trials?${search.toString()}`);
}

export async function getTrial(id: string) {
  return request<TrialDetail>(`/trials/${id}`);
}

export async function listPublications(
  params: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return request<PublicationSummary[]>(`/publications?${search.toString()}`);
}

export async function listPublicationsPage(
  params: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return request<CursorPage<PublicationSummary>>(`/publications?${search.toString()}`);
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
