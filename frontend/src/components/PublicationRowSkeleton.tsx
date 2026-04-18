export function PublicationRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-2 py-6 md:flex-row md:items-start md:justify-between">
      <div className="flex-1 space-y-2.5">
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
        <div className="h-5 w-full animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-[rgba(255,255,255,0.03)]" />
      </div>
    </div>
  );
}
