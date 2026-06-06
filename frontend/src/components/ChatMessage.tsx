import { memo, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { messageEntranceMotion } from "../lib/motion";
import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-3 leading-[1.6] text-text last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-3 space-y-1.5 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-[1.6] text-text marker:text-muted">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-text">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-muted">{children}</em>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 font-semibold text-text">{children}</p>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 font-semibold text-text">{children}</p>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 font-medium text-text">{children}</p>
  ),
};

export const ChatMessage = memo(function ChatMessage({
  message,
  onOpenTrialSnapshot,
}: {
  message: AskMessage;
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const isUser = message.role === "user";
  const prefersReducedMotion = useReducedMotion();
  const entranceMotion = messageEntranceMotion(prefersReducedMotion);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    if (!message.content.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      // Clipboard access can fail in unsupported contexts; fail silently.
    }
  }

  return (
    <motion.div
      initial={entranceMotion.initial}
      animate={entranceMotion.animate}
      transition={entranceMotion.transition}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[92%]">
        <div
          className={`rounded-[24px] shadow-panel ${
            isUser
              ? "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-5 py-3.5 text-[15px] leading-[1.6] text-text backdrop-blur-xl"
              : "group relative border border-line bg-glass px-6 py-5 pr-14 text-[16px] leading-[1.6] text-text backdrop-blur-2xl"
          }`}
        >
          {!isUser ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="focus-ring absolute right-3 top-3 rounded-full p-2 text-muted opacity-0 transition hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
              aria-label={copied ? "Copied" : "Copy response"}
            >
              {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
            </button>
          ) : null}
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && message.sources?.length ? (
          <div className="mt-3 flex max-w-full flex-wrap gap-2">
            {message.sources.map((source) => (
              <SourceChip
                key={`${source.source_type}-${source.source_id}`}
                source={source}
                onOpenTrialSnapshot={onOpenTrialSnapshot}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
});
