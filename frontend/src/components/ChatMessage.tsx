import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";

export function ChatMessage({
  message,
  onOpenTrialSnapshot,
}: {
  message: AskMessage;
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[92%]">
        <div
          className={`rounded-[24px] shadow-panel ${
            isUser
              ? "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-5 py-3.5 text-[15px] leading-[1.6] text-text backdrop-blur-xl"
              : "border border-line bg-glass px-6 py-5 text-[16px] leading-[1.6] text-text backdrop-blur-2xl"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-3 leading-[1.6] text-text last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-3 space-y-1.5 pl-4 last:mb-0">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-3 list-decimal space-y-1.5 pl-4 last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-[1.6] text-text marker:text-muted">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-text">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-muted">{children}</em>
                ),
                h1: ({ children }) => (
                  <p className="mb-2 font-semibold text-text">{children}</p>
                ),
                h2: ({ children }) => (
                  <p className="mb-2 font-semibold text-text">{children}</p>
                ),
                h3: ({ children }) => (
                  <p className="mb-2 font-medium text-text">{children}</p>
                ),
              }}
            >
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
}
