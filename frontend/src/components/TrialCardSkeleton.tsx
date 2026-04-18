export function TrialCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-panel p-7 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-24 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
        <div className="h-7 w-16 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
      </div>

      <div className="mt-6 space-y-2.5">
        <div className="h-5 w-full animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
      </div>

      <div className="mt-3.5 space-y-2">
        <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-[rgba(255,255,255,0.03)]" />
      </div>

      <div className="mt-auto flex gap-3.5 pt-7">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="h-4 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.03)]" />
      </div>
    </div>
  );
}
