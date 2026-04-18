import { AskPanel } from "../components/AskPanel";

export function AskView({
  onOpenTrialSnapshot,
}: {
  onOpenTrialSnapshot?: (trialId: string) => void;
}) {
  return <AskPanel onOpenTrialSnapshot={onOpenTrialSnapshot} />;
}
