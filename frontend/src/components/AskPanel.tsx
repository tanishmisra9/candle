/** The Ask page: example questions, conversation log, fixed composer and the streaming scroll/announcement logic. See the scroll invariant in the module body before changing the follow behaviour (it must be a ref derived from position; the old state-driven version caused an infinite scroll glitch). */
import { ArrowDown, SendHorizonal, Square } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { askQuestion, askQuestionStream } from "../lib/api";
import { markdownToPlainText } from "../lib/plainText";
import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";
import { LastSyncedLabel } from "./LastSyncedLabel";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Tooltip } from "./ui/Tooltip";

// A fixed, plain-language set (it used to be 4 random picks out of 20, several full of jargon like "microperimetry"),
// so everyone sees the same first examples and none needs a clinical vocabulary.
const STARTER_QUESTIONS = [
  "What are researchers currently testing for choroideremia?",
  "Which gene therapy trials are currently recruiting?",
  "What does the research say about how CHM progresses over time?",
  "Are there any completed Phase 3 CHM trials?",
] as const;

// Mirrors the server's default `ask_question_max_chars`; the server stays the authority (it replies 413).
const MAX_QUESTION_CHARS = 2000;

const SLOW_ANSWER_MS = 8000;

// "Following" the stream means being within this many px of the true document bottom.
const STICK_THRESHOLD_PX = 80;

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight;

/**
 * Scroll to the true bottom and remember where we put the page, so the scroll event this causes is not
 * mistaken for the user. The guard is armed ONLY if the page actually moved: when it was already at the
 * bottom no scroll event fires, and a guard left armed would swallow the user's next real (small) scroll
 * and keep following when they had scrolled away.
 */
export function scrollToBottom(guard: { current: number | null }) {
  const before = window.scrollY;
  window.scrollTo(0, document.documentElement.scrollHeight);
  guard.current = window.scrollY !== before ? window.scrollY : null;
}

/** Plain-language text for a failed answer, by what went wrong. The lead sentence is shared so a failure always reads the same way. */
export function describeAskFailure(raw: string) {
  if (/rate limit|too many/i.test(raw)) {
    return { text: "Too many requests. Please wait a moment and try again.", rateLimited: true };
  }
  const lead = "I couldn't complete that answer just now.";
  if (/timed out|timeout/i.test(raw)) {
    return { text: `${lead} It took too long, so please try again.`, rateLimited: false };
  }
  if (/unavailable|overloaded|busy|\b50[234]\b/i.test(raw)) {
    return { text: `${lead} The service is busy, so please try again in a moment.`, rateLimited: false };
  }
  if (/too large|too long|\b413\b/i.test(raw)) {
    return { text: `${lead} The question was too long. Please shorten it and try again.`, rateLimited: false };
  }
  // Developers get the likely local cause; a visitor must never be told to check an API key.
  const devHint = import.meta.env.DEV ? " (Dev: is the backend running and the OpenAI key configured?)" : "";
  return { text: `${lead} Please try again.${devHint}`, rateLimited: false };
}

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Leaving the page abandons any answer in flight (and, through `isCurrent` below, its callbacks).
  useEffect(() => () => abortRef.current?.abort(), []);
  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Late callbacks (a stream that ended after an abort, the fallback request settling after the
    // panel moved on or unmounted) must not touch state or start more requests.
    const isCurrent = () => abortRef.current === controller && !controller.signal.aborted;

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

    // The one place a failed answer is reported: the message stops "streaming", says what happened
    // (keeping nothing half-finished), and the polite live region announces the outcome, so a screen
    // reader user is never left on "Generating answer.".
    // True once the message has reached a final state (an answer, or the failure text), so a late
    // rejection of the stream promise can never replace a finished answer with a failure message.
    let settled = false;
    // True once any answer text was streamed: a retry would then repeat a question the model has
    // already spent tokens on, and replace text the reader has begun to read.
    let streamed = false;

    const failAssistant = (id: string, error: unknown) => {
      settled = true;
      const { text, rateLimited } = describeAskFailure(String((error as Error | undefined)?.message ?? ""));
      setAnnouncement(rateLimited ? text : "Answer could not be completed.");
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, content: text, isStreaming: false, isError: true } : message,
        ),
      );
      setIsPending(false);
    };

    void askQuestionStream(
      trimmed,
      {
        onDelta: (delta) => {
          if (!isCurrent()) return;
          streamed = true;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          );
        },
        onDone: (data) => {
          if (!isCurrent()) return;
          settled = true;
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
        onError: (message, kind) => {
          if (!isCurrent()) return;
          // Retry without streaming ONLY when the stream itself broke before any text arrived. A
          // failure the server reported (rate limit, too long, timeout, outage) would just repeat, and
          // the retry would cost another model call, rate-limit slot and concurrency slot.
          if (kind !== "transport" || streamed) {
            failAssistant(assistantId, new Error(message));
            return;
          }
          void askQuestion(trimmed)
            .then((data) => {
              if (!isCurrent()) return;
              settled = true;
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
              if (isCurrent()) failAssistant(assistantId, error);
            })
            .finally(() => {
              if (isCurrent()) setIsPending(false);
            });
        },
      },
      controller.signal,
    ).catch((error) => {
      // Aborted on purpose (a newer question or leaving the page): nothing to report. Anything else
      // that escapes the stream reader must still finish the message instead of leaving it hanging,
      // unless the message already reached its final state (then it is a bug in a handler of ours:
      // log it, do not wipe a finished answer).
      if (controller.signal.aborted) return;
      if (settled) {
        console.error("Ask stream handler failed after the answer finished", error);
        return;
      }
      failAssistant(assistantId, error);
    });
  };

  // "Try again" / "Edit question" on the failed answer: drop the failed pair, then re-ask or hand the text back.
  const takeFailedQuestion = (errorId: string) => {
    const index = messages.findIndex((message) => message.id === errorId);
    const question = messages[index - 1];
    if (index < 1 || question?.role !== "user") return null;
    setMessages((current) => current.filter((message) => message.id !== errorId && message.id !== question.id));
    return question.content;
  };
  const retryFailed = (errorId: string) => {
    const question = takeFailedQuestion(errorId);
    if (question) sendQuestion(question);
  };
  const editFailed = (errorId: string) => {
    const question = takeFailedQuestion(errorId);
    if (question === null) return;
    setDraft(question);
    inputRef.current?.focus();
  };

  const emptyState = messages.length === 0 && !isPending;
  const lastMessageId = messages[messages.length - 1]?.id;
  const hasConversation = messages.length > 0 || isPending;
  const inFlightAssistant = messages.find(
    (message) => message.role === "assistant" && message.isStreaming,
  );
  const showLoadingDots =
    isPending && !(inFlightAssistant && inFlightAssistant.content.length > 0);

  // Retrieval, rerank and the classifier can take several seconds before the first token: say what is happening, and
  // admit it when it is slow. Visible only (aria-hidden): the polite status region already announces "Generating answer."
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    if (!showLoadingDots) {
      setIsSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setIsSlow(true), SLOW_ANSWER_MS);
    return () => window.clearTimeout(timer);
  }, [showLoadingDots]);

  // Stop: abort the stream (isCurrent() then ignores every late callback and the catch returns, so NO fallback request
  // is sent for an answer the reader walked away from). Nothing streamed yet: hand the question back to the box. Some
  // text streamed: keep it, marked as stopped.
  const stopAnswer = () => {
    abortRef.current?.abort();
    setIsPending(false);
    setAnnouncement("Stopped.");
    const inflightIndex = messages.findIndex((message) => message.role === "assistant" && message.isStreaming);
    const inflight = messages[inflightIndex];
    if (!inflight) return;
    const question = messages[inflightIndex - 1];
    if (inflight.content.length === 0 && question?.role === "user") {
      setMessages((current) => current.filter((message) => message.id !== inflight.id && message.id !== question.id));
      setDraft(question.content);
      inputRef.current?.focus();
      return;
    }
    setMessages((current) =>
      current.map((message) => (message.id === inflight.id ? { ...message, isStreaming: false, isStopped: true } : message)),
    );
  };

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
    scrollToBottom(programmaticYRef);
  }, [messages, isPending, hasConversation]);

  const jumpToLatest = () => {
    stickRef.current = true;
    setShowJumpToLatest(false);
    scrollToBottom(programmaticYRef);
  };

  return (
    // ONE bottom padding (scroll invariant above). With <main>'s own pb-20 this clears the fixed composer (~130px: input,
    // note line, bar padding) by ~60px, which is what the old pb-24 left under the old, shorter composer.
    <div className="space-y-8 pb-28 pt-28 md:space-y-12 md:pt-32">
      <header className="space-y-2">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]">
          Ask
        </h1>
        {emptyState ? (
          <div className="max-w-[46rem] space-y-2">
            <p className="text-[17px] text-muted">Ask about the CHM trials and publications Candle has indexed.</p>
            <p className="text-[14px] leading-[1.6] text-muted">
              Answers come only from those trials and papers. Candle can’t give medical advice, say which trial suits
              you, or predict outcomes, and AI can make mistakes.
            </p>
          </div>
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
              {STARTER_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    sendQuestion(question);
                    // The clicked starter unmounts, which dropped focus to <body>. Hand it to the box, but only with a
                    // mouse-like pointer: on touch it would pop the keyboard over the answer.
                    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) inputRef.current?.focus();
                  }}
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
                  onRetry={message.isError && message.id === lastMessageId ? () => retryFailed(message.id) : undefined}
                  onEdit={message.isError && message.id === lastMessageId ? () => editFailed(message.id) : undefined}
                />
              );
            })}
            {showLoadingDots ? (
              <div className="flex justify-start" data-testid="loading-dots">
                <div className="inline-flex items-center gap-3 rounded-panel border border-line bg-panel px-5 py-4">
                  <span className="inline-flex items-center gap-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-2 w-2 animate-pulse rounded-panel bg-accent"
                        style={{ animationDelay: `${dot * 120}ms` }}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  <span aria-hidden="true" className="text-[14px] text-muted">
                    {isSlow ? "Still working…" : "Searching trials and papers…"}
                  </span>
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
        // The bar itself is the canvas-coloured mask, full width and down to the bottom edge (it used to be a padded box
        // floating 24px up, so answer text showed in the gap below it and beside it), padded by the phone's safe area.
        className="fixed inset-x-0 bottom-0 z-40 bg-canvas px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 md:px-10"
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
          <div className="p-3 md:p-4">
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </span>
            <div className="flex items-center gap-3">
              <label htmlFor={questionFieldId} className="sr-only">
                Ask a question about CHM trials, outcomes, sponsors, or papers
              </label>
              <Input
                ref={inputRef}
                id={questionFieldId}
                data-route-autofocus=""
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about trials or papers"
                maxLength={MAX_QUESTION_CHARS}
              />
              {/* Distinct keys on purpose: with the same key React reuses ONE <button> and flips its type from "button" to
                  "submit" while the Stop click is still being handled, so the browser then submits the form and re-asks the
                  question that was just stopped (jsdom does not show this; the test pins that they are different elements). */}
              {isPending ? (
                <Tooltip key="stop" label="Stop answer" describe={false}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={stopAnswer}
                    aria-label="Stop answer"
                    // `!p-0`: the variant's own px-5 outranks a plain p-0 in the generated CSS and squeezed the icon to ~2px.
                    className="w-11 shrink-0 !p-0"
                  >
                    <Square size={15} strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip key="send" label="Send question" describe={false}>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!draft.trim()}
                    aria-label="Send question"
                    // `!p-0`: the variant's own px-5 outranks a plain p-0 in the generated CSS and squeezed the icon to ~2px.
                    className="w-11 shrink-0 !p-0"
                  >
                    <SendHorizonal size={17} strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3">
              <p className="text-center text-xs text-muted">Not medical advice. AI can make mistakes.</p>
              <LastSyncedLabel />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
