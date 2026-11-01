import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { InboxView } from "@/components/inbox/inbox-view";
import { LIST_LIMIT, queryKeys } from "@/features/query-keys";
import { listTasksQuerySchema } from "@/features/tasks/schemas";
import { listTasks } from "@/server/services/tasks";
import { prefetch } from "../_lib/prefetch";

// ADR-06 + ADR-12: prefetch on the server behind <Suspense>, then hydrate TanStack Query.
export default function InboxPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InboxData />
    </Suspense>
  );
}

async function InboxData() {
  const state = await prefetch(async ({ qc, userId, now }) => {
    // Same query as GET /api/v1/tasks?inbox=true&limit=200 (features/tasks/hooks.ts).
    const query = listTasksQuerySchema.parse({ inbox: "true", limit: String(LIST_LIMIT) });
    qc.setQueryData(queryKeys.tasks.list({ inbox: true }), await listTasks(userId, query, now));
  });
  return (
    <HydrationBoundary state={state}>
      <InboxView />
    </HydrationBoundary>
  );
}
