import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-full border border-line bg-glass px-5 py-3.5 text-[16px] text-text outline-none backdrop-blur-2xl placeholder:text-muted transition-colors",
        "focus-visible:border-[rgba(232,163,61,0.4)] focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
