/** "Data last synced" line; renders nothing while loading, on error, or if no ingest has succeeded. */
import clsx from "clsx";
import { formatLastSynced, formatSyncAge, useLastSynced } from "../hooks/useLastSynced";

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

  // Past two weeks the age is stated in full-contrast text: this date is the only freshness signal next to a status that may have
  // changed since (it was 102 days old, in the same muted grey as the version number).
  const age = formatSyncAge(syncQuery.data.last_synced);

  return (
    <p className={clsx("text-center text-xs text-muted", className)}>
      Data last synced: {formatted}
      {age ? (
        <>
          {" · "}
          <span className="font-medium text-text">{age}</span>
        </>
      ) : null}
    </p>
  );
}
