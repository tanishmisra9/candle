import { Fragment, type ReactNode } from "react";
import { motion } from "framer-motion";

import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";

function normalizeAssistantContent(content: string) {
  return content
    .replace(/\s+(\*\*[A-Z][A-Za-z /-]{1,30}:\*\*)/g, "\n$1")
    .replace(/\s+(?=\d+\.\s+)/g, "\n")
    .trim();
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts
    .filter(Boolean)
    .map((part, index) => {
      const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        return (
          <strong key={index} className="font-semibold text-text">
            {boldMatch[1]}
          </strong>
        );
      }

      return <Fragment key={index}>{part}</Fragment>;
    });
}

function renderAssistantContent(content: string) {
  const normalized = normalizeAssistantContent(content);
  const blocks = normalized.split(/\n{2,}/).filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const orderedLines = lines.filter((line) => /^\d+\.\s+/.test(line));
    if (orderedLines.length === lines.length && orderedLines.length > 0) {
      return (
        <ol
          key={blockIndex}
          className="mb-3 ml-5 list-decimal space-y-2 last:mb-0"
        >
          {orderedLines.map((line, lineIndex) => (
            <li key={lineIndex} className="pl-1 leading-7">
              {renderInline(line.replace(/^\d+\.\s+/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
    if (bulletLines.length === lines.length && bulletLines.length > 0) {
      return (
        <ul
          key={blockIndex}
          className="mb-3 ml-5 list-disc space-y-2 last:mb-0"
        >
          {bulletLines.map((line, lineIndex) => (
            <li key={lineIndex} className="pl-1 leading-7">
              {renderInline(line.replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={blockIndex} className="mb-3 leading-7 text-text last:mb-0">
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}

export function ChatMessage({ message }: { message: AskMessage }) {
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
          className={`rounded-[24px] px-6 py-5 text-[16px] leading-8 shadow-panel ${
            isUser
              ? "bg-[rgba(232,163,61,0.14)] text-text"
              : "border border-line bg-glass text-text backdrop-blur-2xl"
          }`}
        >
          {isUser ? message.content : renderAssistantContent(message.content)}
        </div>
        {!isUser && message.sources?.length ? (
          <div className="mt-3 flex max-w-full flex-wrap gap-2">
            {message.sources.map((source) => (
              <SourceChip
                key={`${source.source_type}-${source.source_id}`}
                source={source}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
