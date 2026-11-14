/** The Ask page: example questions, conversation log, fixed composer and the streaming scroll/announcement logic. See the scroll invariant in the module body before changing the follow behaviour (it must be a ref derived from position; the old state-driven version caused an infinite scroll glitch). */
import { ArrowDown, SendHorizonal } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { askQuestion, askQuestionStream } from "../lib/api";
import { markdownToPlainText } from "../lib/plainText";
import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";
import { LastSyncedLabel } from "./LastSyncedLabel";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Tooltip } from "./ui/Tooltip";

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

// "Following" the stream means being within this many px of the true document bottom.
const STICK_THRESHOLD_PX = 80;

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight;

export function AskPanel({
  onOpenTrialSnapshot,
}: {
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  // Always-mounted polite region: text is swapped on state changes (inserting a live region that
  // already has text is announced unreliably). It carries the finished answer, not the deltas.
  const [announcement, setAnnouncement] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const questionFieldId = useId();
  // Whether the page should follow new content. A ref, not state: it must never re-run the
  // follow effect (that feedback loop was the "infinite scroll" glitch).
  const stickRef = useRef(true);
  // scrollY after our own scrollTo, so the scroll event it fires isn't mistaken for the user.
  const programmaticYRef = useRef<number | null>(null);
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
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);
    setDraft("");
    setAnnouncement("Generating answer.");
    setIsPending(true);
    stickRef.current = true;
    setShowJumpToLatest(false);

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
          setAnnouncement(markdownToPlainText(data.answer));
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: data.answer,
                    sources: data.sources,
                    isStreaming: false,
                  }
                : message,
            ),
          );
          setIsPending(false);
        },
        onError: () => {
          void askQuestion(trimmed)
            .then((data) => {
              setAnnouncement(markdownToPlainText(data.answer));
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: data.answer,
                        sources: data.sources,
                        isStreaming: false,
                      }
                    : message,
                ),
              );
            })
            .catch((error) => {
              const isRateLimited = /rate limit|too many/i.test(String(error?.message ?? ""));
              setAnnouncement(
                isRateLimited
                  ? "Too many requests. Please wait a moment and try again."
                  : "Answer could not be completed.",
              );
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: isRateLimited
                          ? "Too many requests. Please wait a moment and try again."
                          : "I couldn't complete that answer just now. Please check that the backend is running and the OpenAI key is configured.",
                        isStreaming: false,
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
  const inFlightAssistant = messages.find(
    (message) => message.role === "assistant" && message.isStreaming,
  );
  const showLoadingDots =
    isPending && !(inFlightAssistant && inFlightAssistant.content.length > 0);

  // Stickiness is derived from position, and only from scrolls we did not cause ourselves.
  useEffect(() => {
    const onScroll = () => {
      if (
        programmaticYRef.current !== null &&
        Math.abs(window.scrollY - programmaticYRef.current) < 1
      ) {
        return;
      }
      programmaticYRef.current = null;
      const stuck = distanceFromBottom() <= STICK_THRESHOLD_PX;
      stickRef.current = stuck;
      setShowJumpToLatest(!stuck);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Follow growth by scrolling to the true bottom (not a sentinel above the padding), so our own
  // scroll always lands inside the stick threshold and can never unstick itself.
  useLayoutEffect(() => {
    if (!hasConversation || !stickRef.current) {
      return;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    programmaticYRef.current = window.scrollY;
  }, [messages, isPending, hasConversation]);

  const jumpToLatest = () => {
    stickRef.current = true;
    setShowJumpToLatest(false);
    window.scrollTo(0, document.documentElement.scrollHeight);
    programmaticYRef.current = window.scrollY;
  };

  return (
    <div className="space-y-8 pb-24 pt-28 md:space-y-12 md:pt-32">
      <header className="space-y-2">
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
        className="min-h-[280px] space-y-10"
        role="log"
        aria-live="off"
        aria-label="Conversation"
      >
        {emptyState ? (
          <div className="pt-12">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {exampleQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendQuestion(question)}
                  className="inline-flex min-h-12 items-center rounded-panel border border-line-strong bg-panel px-5 py-3.5 text-left text-[15px] text-muted transition-colors hover:border-accent hover:text-text"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => {
              if (
                message.role === "assistant" &&
                message.isStreaming &&
                message.content.length === 0
              ) {
                return null;
              }

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onOpenTrialSnapshot={onOpenTrialSnapshot}
                />
              );
            })}
            {showLoadingDots ? (
              <div className="flex justify-start" role="status">
                <div className="inline-flex items-center gap-2 rounded-panel border border-line bg-panel px-5 py-4">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-pulse rounded-panel bg-accent"
                      style={{ animationDelay: `${dot * 120}ms` }}
                      aria-hidden="true"
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
        className="fixed inset-x-0 bottom-6 z-40 px-4 sm:px-5 md:px-10"
      >
        <div className="mx-auto w-full max-w-[1360px]">
          {showJumpToLatest && hasConversation ? (
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={jumpToLatest}
                className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-line-strong bg-panel px-4 text-[14px] font-medium text-text transition-colors hover:border-accent"
              >
                <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
                Jump to latest
              </button>
            </div>
          ) : null}
          {/* No outer outline: the input carries its own 3:1 border (WCAG 1.4.11). The canvas background
              only hides messages scrolling underneath the fixed composer. */}
          <div className="bg-canvas p-3 md:p-4">
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
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
              />
              <Tooltip label="Send question" describe={false}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!draft.trim() || isPending}
                  aria-label="Send question"
                  className="w-11 shrink-0 p-0"
                >
                  <SendHorizonal size={17} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
            <LastSyncedLabel className="mt-2" />
          </div>
        </div>
      </form>
    </div>
  );
}
