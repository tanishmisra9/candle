import { useMutation } from "@tanstack/react-query";
import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { askQuestion } from "../lib/api";
import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export function AskPanel({
  onOpenTrialSnapshot,
}: {
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);

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
    setDraft("");
    mutation.mutate(trimmed);
  };

  const emptyState = messages.length === 0 && !mutation.isPending;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-148px)] max-w-[920px] flex-col justify-center pb-16 pt-28">
      <div className="flex-1 space-y-10">
        {emptyState ? (
          <div className="pb-32 pt-20 text-center">
            <h1 className="text-[48px] font-medium tracking-[-0.04em] text-text md:text-[62px]">
              Ask
            </h1>
            <p className="mt-4 text-[17px] text-muted">
              Research-backed responses
            </p>
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
        className="fixed bottom-6 left-1/2 z-40 w-full max-w-[860px] -translate-x-1/2 px-4"
      >
        <div className="rounded-[32px] border border-line bg-glass p-4 shadow-panel backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about CHM trials, outcomes, sponsors, or papers"
              className="!border-[1.5px] !border-[rgba(255,255,255,0.045)] !bg-[rgba(18,18,24,0.74)] px-4 py-4 text-[17px] !shadow-[0_8px_22px_rgba(0,0,0,0.12)] transition-colors hover:!border-[rgba(255,255,255,0.06)] focus-visible:!border-[rgba(255,255,255,0.08)] focus-visible:!ring-0 focus-visible:!ring-offset-0"
            />
            {draft.trim() ? (
              <Button type="submit" variant="primary" className="h-12 w-12 p-0">
                <SendHorizonal size={17} strokeWidth={1.5} />
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}
