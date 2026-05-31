import { useReducedMotion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { askQuestion, askQuestionStream } from "../lib/api";
import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const EXAMPLE_QUESTIONS = [
  "Which CHM gene therapy trials are currently recruiting?",
  "What did the RTx-015 Phase 1 trial report?",
  "What publications exist on AAV gene therapy for CHM?",
  "Which trials have the most enrolled participants?",
  "What is the primary endpoint of the Kiora KIO-301 trial?",
  "Which trials are sponsored by 4D Molecular Therapeutics?",
  "What does the research say about natural disease progression in CHM?",
  "Are there any completed Phase 3 CHM trials?",
  "Which trials are currently enrolling by invitation?",
  "What imaging outcomes have been reported in CHM publications?",
  "What gene therapy vectors have been studied for CHM?",
  "Which trials have sites outside the United States?",
  "What visual acuity outcomes have been reported in CHM gene therapy trials?",
  "Which sponsor has run the most CHM trials?",
  "What is the total enrollment across all CHM trials?",
  "Are there any observational studies tracking CHM disease progression?",
  "What publications are linked to the Biogen natural history study?",
  "Which trials use microperimetry as an outcome measure?",
  "What CHM trials have been withdrawn or terminated?",
  "Are there any trials studying vitamin A or neuroprotective treatments for CHM?",
] as const;

export function AskPanel({
  onOpenTrialSnapshot,
}: {
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const questionFieldId = useId();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const exampleQuestions = useMemo(() => {
    return [...EXAMPLE_QUESTIONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
  }, []);

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStatusMessage("Generating answer.");
    setDraft("");
    setIsPending(true);

    void askQuestionStream(
      trimmed,
      {
        onDelta: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          );
        },
        onDone: (data) => {
          setStatusMessage("Answer received.");
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: data.answer,
                    sources: data.sources,
                  }
                : message,
            ),
          );
          setIsPending(false);
        },
        onError: () => {
          void askQuestion(trimmed)
            .then((data) => {
              setStatusMessage("Answer received.");
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: data.answer,
                        sources: data.sources,
                      }
                    : message,
                ),
              );
            })
            .catch(() => {
              setStatusMessage("Answer could not be completed.");
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content:
                          "I couldn't complete that answer just now. Please check that the backend is running and the OpenAI key is configured.",
                      }
                    : message,
                ),
              );
            })
            .finally(() => {
              setIsPending(false);
            });
        },
      },
      controller.signal,
    ).catch(() => {
      if (!controller.signal.aborted) {
        setIsPending(false);
      }
    });
  };

  const emptyState = messages.length === 0 && !isPending;
  const hasConversation = messages.length > 0 || isPending;

  useEffect(() => {
    if (!hasConversation) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, isPending, prefersReducedMotion, hasConversation]);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-148px)] max-w-[920px] flex-col justify-center pb-16 pt-28">
      <header className={cn("space-y-2 transition-all", emptyState ? "pb-8" : "pb-4")}>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          Ask
        </h1>
        {emptyState ? (
          <p className="text-[17px] text-muted">
            Ask anything about indexed CHM trials and publications.
          </p>
        ) : null}
      </header>
      <div
        className="min-h-[280px] flex-1 space-y-10"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation"
      >
        {emptyState ? (
          <div className="pb-32 pt-12">
            <div className="mx-auto grid max-w-[760px] grid-cols-1 gap-4 md:grid-cols-2">
              {exampleQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendQuestion(question)}
                  className="focus-ring inline-flex min-h-12 rounded-full border border-line bg-glass px-5 py-3.5 text-left text-[15px] text-muted shadow-panel backdrop-blur-2xl transition hover:border-[rgba(232,163,61,0.28)] hover:text-text"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-32">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onOpenTrialSnapshot={onOpenTrialSnapshot}
              />
            ))}
            {isPending ? (
              <div className="flex justify-start" role="status" aria-live="polite">
                <div className="inline-flex items-center gap-2 rounded-[22px] border border-line bg-glass px-5 py-4 backdrop-blur-2xl">
                  <span className="sr-only">Generating answer</span>
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-pulse rounded-full bg-accent"
                      style={{ animationDelay: `${dot * 120}ms` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendQuestion(draft);
        }}
        className="fixed bottom-6 left-1/2 z-40 w-full max-w-[860px] -translate-x-1/2 px-4"
      >
        <div className="rounded-[32px] border border-line bg-glass p-4 shadow-panel backdrop-blur-2xl">
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </span>
          <div className="flex items-center gap-3">
            <label htmlFor={questionFieldId} className="sr-only">
              Ask a question about CHM trials, outcomes, sponsors, or papers
            </label>
            <Input
              id={questionFieldId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about CHM trials, outcomes, sponsors, or papers"
              className="border-[rgba(255,255,255,0.045)] bg-[rgba(18,18,24,0.74)] px-4 py-4 text-[17px] shadow-[0_8px_22px_rgba(0,0,0,0.12)] hover:border-[rgba(255,255,255,0.07)] focus-visible:border-[rgba(255,255,255,0.08)] focus-visible:ring-2 focus-visible:ring-[rgba(232,163,61,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!draft.trim() || isPending}
              aria-label="Send question"
              className="h-12 w-12 shrink-0 p-0 opacity-100 transition-opacity disabled:opacity-30"
            >
              <SendHorizonal size={17} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
