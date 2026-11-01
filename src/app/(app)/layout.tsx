import { Suspense } from "react";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionGate } from "./session-gate";

// ADR-11 + ADR-12: the full session check and the user's locale are read at request
// time, so the shell streams in behind <Suspense>; the fallback keeps the same layout.
// QueryProvider (ADR-06) is a client component without request data, so it stays outside.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <QueryProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <Suspense fallback={<AppShellSkeleton />}>
          <SessionGate>{children}</SessionGate>
        </Suspense>
      </div>
    </QueryProvider>
  );
}
