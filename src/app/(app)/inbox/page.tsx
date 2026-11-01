import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { InboxView } from "@/components/inbox/inbox-view";
import { firstPage } from "@/features/infinite";
import { PAGE_SIZE, queryKeys } from "@/features/query-keys";
import { parseListParams, toListQuery } from "@/features/tasks/list-params";
import { listTasksQuerySchema } from "@/features/tasks/schemas";
import { getCurrentSession } from "@/server/session";
import { listTasks } from "@/server/services/tasks";
import { prefetch } from "../_lib/prefetch";

type Props = PageProps<"/inbox">;

// ADR-06 + ADR-12: prefetch the first page on the server behind <Suspense>, then hydrate.
export default function InboxPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InboxData searchParams={searchParams} />
    </Suspense>
  );
}

async function InboxData({ searchParams }: Pick<Props, "searchParams">) {
  const raw = await searchParams;
  // Same filters, key and query as ListView (features/tasks/list-params.ts).
  const params = parseListParams({
    get: (name) => (typeof raw[name] === "string" ? raw[name] : null),
  });
  const timezone = (await getCurrentSession())?.user.timezone ?? "UTC";
  const state = await prefetch(async ({ qc, userId, now }) => {
    const query = listTasksQuerySchema.parse({
      ...toListQuery({ inbox: true }, params, timezone),
      limit: String(PAGE_SIZE),
    });
    qc.setQueryData(
      queryKeys.tasks.list({ inbox: true }, params),
      firstPage(await listTasks(userId, query, now)),
    );
  });
  return (
    <HydrationBoundary state={state}>
      <InboxView />
    </HydrationBoundary>
  );
}
