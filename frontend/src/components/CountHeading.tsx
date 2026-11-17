/**
 * The page `<h1>` for Trials and Literature ("29 trials tracked"). The element is always mounted (it is the route-change focus target
 * and it holds the layout), but it stays invisible until the number is final, then blurs in once. A load never shows a placeholder word
 * that snaps to the number. After the first reveal it never hides again: while a filter refetches (`text` is null) it keeps the last
 * known text, so the heading does not blink on every change.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { countHeadingMotion } from "../lib/motion";

/** How long the heading waits for a number before it shows the plain fallback (a stalled request must not leave the page untitled). */
export const HEADING_WAIT_MS = 3000;

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
  // State, not a ref written during render. `last` is the most recent number; `revealed` latches so a heading that has shown never hides.
  const [last, setLast] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  if (text !== null && text !== last) setLast(text);
  const known = text ?? last;
  const ready = known !== null || failed || timedOut;
  if (ready && !revealed) setRevealed(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), HEADING_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const show = ready || revealed;
  // A failure shows the fallback, never an older number beside an error panel.
  const content = failed ? fallback : (known ?? fallback);
  const variants = countHeadingMotion(useReducedMotion());

  return (
    <motion.h1
      className="text-[34px] font-medium tracking-[-0.03em] text-text md:text-[42px]"
      variants={variants}
      initial="hidden"
      animate={show ? "shown" : "hidden"}
      data-ready={show}
    >
      {content}
    </motion.h1>
  );
}
