/** The one "this failed to load" block: what failed, one verb. Rendered INSTEAD of the list/empty state, never beside them. */
import { Button } from "./ui/Button";

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-panel border border-line bg-panel p-6 text-[15px] text-muted">
      <p>{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
