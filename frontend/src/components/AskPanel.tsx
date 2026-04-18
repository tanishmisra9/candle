import { useMutation } from "@tanstack/react-query";
import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { askQuestion } from "../lib/api";
import type { AskMessage } from "../types";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const SUGGESTED_QUESTIONS = [
  "Which CHM gene therapy trials are recruiting right now?",
  "What visual outcomes were reported in AAV2-REP1 trials?",
];

export function AskPanel() {
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

  return (
    <section className="mx-auto flex min-h-[calc(100vh-160px)] max-w-[720px] flex-col justify-center pb-12 pt-24">
      <div className="flex-1 space-y-8">
        {emptyState ? (
          <div className="pt-16 text-center">
            <h1 className="text-[38px] font-medium tracking-[-0.03em] text-text md:text-[44px]">
              Ask
            </h1>
            <p className="mt-3 text-[15px] text-muted">
              Research-backed responses
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-[540px] flex-col gap-3">
              {SUGGESTED_QUESTIONS.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft(question)}
                  className="min-h-[68px] w-full justify-start whitespace-normal rounded-[18px] px-5 py-4 text-left text-[13px] leading-5"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
        className="sticky bottom-6 mt-10 rounded-[28px] border border-line bg-glass p-3 shadow-panel backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about CHM trials, outcomes, sponsors, or papers"
            className="border-transparent bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
          />
          {draft.trim() ? (
            <Button type="submit" variant="primary" className="h-11 w-11 p-0">
              <SendHorizonal size={16} strokeWidth={1.5} />
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
