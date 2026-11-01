import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { IntlBoundary } from "@/components/i18n/intl-boundary";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { LocalizedToaster } from "@/components/providers/localized-toaster";
import { ShortcutsProvider } from "@/components/shortcuts/shortcuts-provider";
import { listProjectsQuerySchema } from "@/features/projects/schemas";
import { LIST_LIMIT, queryKeys } from "@/features/query-keys";
import { listProjects } from "@/server/services/projects";
import { getCurrentSession } from "@/server/session";
import { prefetch } from "./_lib/prefetch";

// Full session check (ADR-11): expired or forged cookies are sent back to /login.
// Renders the app shell (docs/06 section 2) in the user's locale.
export async function SessionGate({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // The sidebar's project list (ADR-06 first read); same query as ProjectNavList.
  const state = await prefetch(async ({ qc, userId, now }) => {
    const query = listProjectsQuerySchema.parse({ status: "ACTIVE", limit: String(LIST_LIMIT) });
    qc.setQueryData(queryKeys.projects.list("ACTIVE"), await listProjects(userId, query, now));
  });

  return (
    <IntlBoundary className="flex min-h-full flex-1">
      <ShortcutsProvider>
        <HydrationBoundary state={state}>
          <Sidebar />
        </HydrationBoundary>
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader user={{ name: session.user.name, email: session.user.email }} />
          <main className="flex flex-1 flex-col pb-20 md:pb-0">{children}</main>
        </div>
        <BottomNav />
        <LocalizedToaster />
      </ShortcutsProvider>
    </IntlBoundary>
  );
}
