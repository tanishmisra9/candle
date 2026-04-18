import { motion } from "framer-motion";

import type { AskMessage } from "../types";
import { SourceChip } from "./SourceChip";

export function ChatMessage({ message }: { message: AskMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[88%]">
        <div
          className={`rounded-[22px] px-5 py-4 text-[15px] leading-7 shadow-panel ${
            isUser
              ? "bg-[rgba(232,163,61,0.14)] text-text"
              : "border border-line bg-glass text-text backdrop-blur-2xl"
          }`}
        >
          {message.content}
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
