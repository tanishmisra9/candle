import clsx from "clsx";
import { formatLastSynced, useLastSynced } from "../hooks/useLastSynced";

type LastSyncedLabelProps = {
  className?: string;
};

export function LastSyncedLabel({ className }: LastSyncedLabelProps) {
  const syncQuery = useLastSynced();

  if (syncQuery.isPending || syncQuery.isError || !syncQuery.data?.last_synced) {
    return null;
  }

  const formatted = formatLastSynced(syncQuery.data.last_synced);
  if (!formatted) {
    return null;
  }

  return (
    <p className={clsx("text-center text-xs text-muted/70", className)}>
      Data last synced: {formatted}
    </p>
  );
}
