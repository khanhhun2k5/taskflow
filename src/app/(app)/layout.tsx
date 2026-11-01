import { Suspense } from "react";
import { SessionGate } from "./session-gate";

// ADR-11 + ADR-12: static shell renders immediately; the full session check reads
// headers at request time, so it streams in behind <Suspense> with a skeleton fallback.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<PageSkeleton />}>
        <SessionGate>{children}</SessionGate>
      </Suspense>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
