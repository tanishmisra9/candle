import { useMutation, useQuery } from "@tanstack/react-query";
import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { askQuestion, listPublications, listTrials } from "../lib/api";
import type { AskMessage, PublicationSummary, TrialSummary } from "../types";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const FALLBACK_QUESTIONS = [
  "Which CHM trials are currently recruiting, and how do their phases compare?",
  "What are the newest linked publications in the current CHM dataset?",
];

function isRecruiting(status: string | null) {
  const normalized = status?.toLowerCase() ?? "";
  return /recruiting|enrolling/.test(normalized) && !/not recruiting/.test(normalized);
}

function compactLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSuggestedQuestions(
  trials: TrialSummary[] | undefined,
  publications: PublicationSummary[] | undefined,
) {
  const questions: string[] = [];
  const currentTrials = trials ?? [];
  const currentPublications = publications ?? [];

  const recruitingTrials = currentTrials
    .filter((trial) => isRecruiting(trial.status))
    .sort((left, right) => (right.enrollment ?? 0) - (left.enrollment ?? 0));
  const featuredRecruitingTrial = recruitingTrials[0];

  if (featuredRecruitingTrial) {
    const label =
      featuredRecruitingTrial.intervention &&
      featuredRecruitingTrial.intervention.length <= 42
        ? featuredRecruitingTrial.intervention
        : compactLabel(featuredRecruitingTrial.title, 62);

    questions.push(
      `What do we know about the recruiting trial ${label} (${featuredRecruitingTrial.id})?`,
    );
  } else if (currentTrials.length) {
    questions.push(
      "Which sponsors and phases show up most often across the current CHM trials?",
    );
  }

  const newestLinkedPublication = currentPublications
    .filter((publication) => publication.trial_id)
    .sort((left, right) => {
      const leftTime = left.pub_date ? Date.parse(left.pub_date) : 0;
      const rightTime = right.pub_date ? Date.parse(right.pub_date) : 0;
      return rightTime - leftTime;
    })[0];

  if (newestLinkedPublication) {
    const author = newestLinkedPublication.authors[0]?.split(",")[0] ?? "the lead authors";
    const year = newestLinkedPublication.pub_date?.slice(0, 4);
    questions.push(
      `What are the key findings from ${author}'s ${year ?? "recent"} paper, and which trial does it connect to?`,
    );
  } else if (currentPublications.length) {
    questions.push("What are the newest publications in the current CHM literature dataset?");
  }

  const uniqueQuestions = Array.from(new Set(questions));
  return uniqueQuestions.length >= 2
    ? uniqueQuestions.slice(0, 2)
    : FALLBACK_QUESTIONS;
}

export function AskPanel() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);

  const suggestionTrialsQuery = useQuery({
    queryKey: ["ask", "suggestions", "trials"],
    queryFn: () => listTrials({ limit: 500 }),
    enabled: messages.length === 0,
    staleTime: 60_000,
  });

  const suggestionPublicationsQuery = useQuery({
    queryKey: ["ask", "suggestions", "publications"],
    queryFn: () => listPublications({ limit: 500 }),
    enabled: messages.length === 0,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: askQuestion,
    onSuccess: (data, question) => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${current.length + 1}`,
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
      setDraft("");
    },
    onError: () => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${current.length + 1}`,
          role: "assistant",
          content:
            "I couldn't complete that answer just now. Please check that the backend is running and the OpenAI key is configured.",
        },
      ]);
    },
  });

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;
    setMessages((current) => [
      ...current,
      { id: `user-${current.length + 1}`, role: "user", content: trimmed },
    ]);
    mutation.mutate(trimmed);
  };

  const emptyState = messages.length === 0 && !mutation.isPending;
  const suggestedQuestions = buildSuggestedQuestions(
    suggestionTrialsQuery.data,
    suggestionPublicationsQuery.data,
  );

  return (
    <section className="mx-auto flex min-h-[calc(100vh-148px)] max-w-[920px] flex-col justify-center pb-16 pt-28">
      <div className="flex-1 space-y-10">
        {emptyState ? (
          <div className="pt-20 text-center">
            <h1 className="text-[48px] font-medium tracking-[-0.04em] text-text md:text-[62px]">
              Ask
            </h1>
            <p className="mt-4 text-[17px] text-muted">
              Research-backed responses
            </p>
            <div className="mx-auto mt-10 flex w-full max-w-[720px] flex-col gap-4">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft(question)}
                  className="min-h-[86px] w-full justify-start whitespace-normal rounded-[22px] px-6 py-5 text-left text-[15px] leading-6"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {mutation.isPending ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-[22px] border border-line bg-glass px-5 py-4 backdrop-blur-2xl">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-pulse rounded-full bg-accent"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendQuestion(draft);
        }}
        className="sticky bottom-8 mt-12 rounded-[32px] border border-line bg-glass p-4 shadow-panel backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about CHM trials, outcomes, sponsors, or papers"
            className="border-transparent bg-transparent px-4 py-4 text-[17px] shadow-none focus-visible:ring-0"
          />
          {draft.trim() ? (
            <Button type="submit" variant="primary" className="h-12 w-12 p-0">
              <SendHorizonal size={17} strokeWidth={1.5} />
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
