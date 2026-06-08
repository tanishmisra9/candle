import { useLocation } from "react-router-dom";

import { LastSyncedLabel } from "./LastSyncedLabel";

export function Footer() {
  const location = useLocation();

  // On the Ask page the sync label is rendered below the fixed input bar instead.
  if (location.pathname === "/ask") {
    return null;
  }

  return (
    <footer className="mx-auto max-w-[1360px] px-4 pb-10 pt-2 sm:px-5 md:px-10">
      <LastSyncedLabel />
    </footer>
  );
}
