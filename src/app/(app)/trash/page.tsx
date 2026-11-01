import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { TrashView } from "@/components/trash/trash-view";
import { firstPage } from "@/features/infinite";
import { PAGE_SIZE, queryKeys } from "@/features/query-keys";
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
    // Same first page as GET /api/v1/trash?limit=50 (features/tasks/hooks.ts).
    const query = trashQuerySchema.parse({ limit: String(PAGE_SIZE) });
    qc.setQueryData(queryKeys.trash.all, firstPage(await listTrash(userId, query)));
  });
  return (
    <HydrationBoundary state={state}>
      <TrashView />
    </HydrationBoundary>
  );
}
