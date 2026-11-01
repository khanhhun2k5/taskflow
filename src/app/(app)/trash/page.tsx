import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { TrashView } from "@/components/trash/trash-view";
import { LIST_LIMIT, queryKeys } from "@/features/query-keys";
import { trashQuerySchema } from "@/features/tasks/schemas";
import { listTrash } from "@/server/services/tasks";
import { prefetch } from "../_lib/prefetch";

export default function TrashPage() {
  return (
    <Suspense fallback={<ListPageSkeleton withInput={false} />}>
      <TrashData />
    </Suspense>
  );
}

async function TrashData() {
  const state = await prefetch(async ({ qc, userId }) => {
    // Same query as GET /api/v1/trash?limit=200 (features/tasks/hooks.ts).
    const query = trashQuerySchema.parse({ limit: String(LIST_LIMIT) });
    qc.setQueryData(queryKeys.trash.all, await listTrash(userId, query));
  });
  return (
    <HydrationBoundary state={state}>
      <TrashView />
    </HydrationBoundary>
  );
}
