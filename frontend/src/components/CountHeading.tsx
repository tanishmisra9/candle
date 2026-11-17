/**
 * The page `<h1>` for Trials and Literature ("29 trials tracked"). The element is always mounted (it is the route-change focus target
 * and it holds the layout), but it stays invisible until the number is final, then blurs in once. A load never shows a placeholder word
 * that snaps to the number. After the first reveal it never hides again: while a filter refetches (`text` is null) it keeps the last
 * known text, so the heading does not blink on every change.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";

import { countHeadingMotion } from "../lib/motion";

export function CountHeading({
  text,
  fallback,
  failed,
}: {
  /** The final heading text, or null while the number is not known yet. */
  text: string | null;
  /** What the heading says when there is no number to show (and what a screen reader finds before it arrives). */
  fallback: string;
  /** The request failed and there is nothing to show: reveal the fallback rather than wait forever. */
  failed: boolean;
}) {
  const last = useRef<string | null>(null);
  if (text !== null) last.current = text;
  const shown = text ?? last.current;
  const ready = shown !== null || failed;
  const variants = countHeadingMotion(useReducedMotion());

  return (
    <motion.h1
      className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]"
      variants={variants}
      initial="hidden"
      animate={ready ? "shown" : "hidden"}
      data-ready={ready}
    >
      {shown ?? fallback}
    </motion.h1>
  );
}
