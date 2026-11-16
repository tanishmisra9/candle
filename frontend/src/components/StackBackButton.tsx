/** "← Back to trial NCT…" in the header of a dialog that sits on top of another one, so the reader knows what is underneath. Closes the top dialog (same as the X); the lower one becomes active again. */
import { ChevronLeft } from "lucide-react";

export function StackBackButton({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    // -my-3 keeps the 44px hit area from making the fixed header taller than its single kicker line.
    <button
      type="button"
      onClick={onBack}
      className="kicker -my-3 inline-flex whitespace-nowrap min-h-11 items-center gap-1 text-[11px] text-muted transition-colors hover:text-text md:text-[12px]"
    >
      <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
      Back to {label}
    </button>
  );
}
