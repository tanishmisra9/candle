/** One Ask message: user text or assistant markdown, a copy button (always visible on touch, on hover/focus otherwise) and source chips. Announcements are handled by the status region in `AskPanel`, not here. */
import { memo, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { messageEntranceMotion } from "../lib/motion";
import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";
import { StatusMarker } from "./StatusBadge";
import { Button } from "./ui/Button";
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
  // Links, tables, code and quotes had no styling at all: a link looked like plain text and a table was an
  // unbordered run of cramped columns.
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2 hover:text-text"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-[14px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-line px-3 py-2 font-medium text-text">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-line px-3 py-2 align-top text-text">{children}</td>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded-panel bg-text/[0.06] px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-panel border border-line bg-text/[0.04] p-3 text-[13px] last:mb-0 [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="mb-3 border-l border-line-strong pl-4 text-muted last:mb-0">{children}</blockquote>
  ),
};

export const ChatMessage = memo(function ChatMessage({
  message,
  onOpenTrialSnapshot,
  onRetry,
  onEdit,
}: {
  message: AskMessage;
  onOpenTrialSnapshot?: (trialId: string) => void;
  /** Only passed for the latest failed answer. */
  onRetry?: () => void;
  onEdit?: () => void;
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

  if (message.isError) {
    // A failure is not an answer: its own look (marker + label, so not colour alone), no Copy, no sources, and a way
    // forward that keeps the question.
    return (
      <motion.div
        initial={entranceMotion.initial}
        animate={entranceMotion.animate}
        transition={entranceMotion.transition}
        className="flex justify-start"
      >
        <div className="max-w-[92%] space-y-3">
          <div className="rounded-panel border border-line-strong bg-panel px-6 py-5 text-[16px] leading-[1.6] text-text">
            <p className="kicker mb-2 inline-flex items-center gap-2 text-[11px] text-muted">
              <StatusMarker tier="terminated" />
              Answer failed
            </p>
            <p>{message.content}</p>
          </div>
          {onRetry || onEdit ? (
            <div className="flex flex-wrap gap-2">
              {onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}
              {onEdit ? <Button variant="ghost" onClick={onEdit}>Edit question</Button> : null}
            </div>
          ) : null}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={entranceMotion.initial}
      animate={entranceMotion.animate}
      transition={entranceMotion.transition}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="group max-w-[92%]">
        <div
          className={`rounded-panel ${
            isUser
              ? "border border-line bg-text/[0.05] px-5 py-3.5 text-[15px] leading-[1.6] text-text"
              : "border border-line bg-panel px-6 py-5 text-[16px] leading-[1.6] text-text"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser ? (
          // One row under the bubble: the sources, then Copy at the end. Copy used to sit in the bubble's corner,
          // which reserved 56px of a ~250px text column on a phone.
          <div className="mt-3 flex max-w-full flex-wrap items-center gap-2">
            {message.sources?.length ? (
              <>
                <span className="kicker text-[11px] text-muted">Sources ({message.sources.length})</span>
                {message.sources.map((source) => (
                  <SourceChip
                    key={`${source.source_type}-${source.source_id}`}
                    source={source}
                    onOpenTrialSnapshot={onOpenTrialSnapshot}
                  />
                ))}
              </>
            ) : null}
            <div className="ml-auto opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
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
          </div>
        ) : null}
      </div>
    </motion.div>
  );
});
