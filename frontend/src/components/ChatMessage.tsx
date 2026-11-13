import { memo, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { messageEntranceMotion } from "../lib/motion";
import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";
import { Tooltip } from "./ui/Tooltip";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-3 leading-[1.6] text-text last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
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
          className={`rounded-panel ${
            isUser
              ? "border border-line bg-text/[0.05] px-5 py-3.5 text-[15px] leading-[1.6] text-text"
              : "group relative border border-line bg-panel py-5 pl-6 pr-14 text-[16px] leading-[1.6] text-text"
          }`}
          // While streaming, hold announcements; the finished answer is announced once.
          aria-live={isUser ? undefined : "polite"}
          aria-busy={isUser ? undefined : Boolean(message.isStreaming)}
        >
          {!isUser ? (
            <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
              <Tooltip label={copied ? "Copied" : "Copy response"} describe={false}>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-panel text-muted transition-colors hover:bg-text/5 hover:text-text"
                  aria-label={copied ? "Copied" : "Copy response"}
                >
                  {copied ? (
                    <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </Tooltip>
            </div>
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
