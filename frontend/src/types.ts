export type TrialSummary = {
  id: string;
  title: string;
  status: string | null;
  phase: string | null;
  start_date: string | null;
  completion_date: string | null;
  sponsor: string | null;
  intervention: string | null;
  intervention_type: string | null;
  enrollment: number | null;
  primary_endpoint: string | null;
  locations: Array<{
    city?: string | null;
    country?: string | null;
    facility?: string | null;
    status?: string | null;
  }>;
  contact_email: string | null;
  url: string;
};

export type PublicationSummary = {
  pmid: string;
  trial_id: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  pub_date: string | null;
  abstract: string | null;
  doi: string | null;
  url: string;
};

export type CursorPage<T> = {
  items: T[];
  next_cursor: string | null;
};

export type OutcomeEntry = {
  outcome_type: string;
  measure: string;
  description: string | null;
  timeframe: string | null;
};

export type TrialDetail = TrialSummary & {
  ai_summary: string | null;
  publications: PublicationSummary[];
  outcomes: OutcomeEntry[];
};

export type AskSource = {
  source_type: "trial" | "publication";
  source_id: string;
  title: string;
  url: string | null;
  label?: string | null;
  detail?: string | null;
};

export type AskResponse = {
  answer: string;
  sources: AskSource[];
};

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AskSource[];
};
