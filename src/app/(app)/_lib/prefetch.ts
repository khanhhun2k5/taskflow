import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { AppError } from "@/server/errors";
import { getCurrentSession } from "@/server/session";

type PrefetchContext = { qc: QueryClient; userId: string; now: Date };

/**
 * First read (ADR-06): load data through the service layer on the server and hand it to
 * TanStack Query via <HydrationBoundary>. Reads the session, so callers render inside
 * <Suspense> with a skeleton (ADR-12). Data must match the JSON of the matching
 * /api/v1 route, since the client refetches the same query key later.
 */
export async function prefetch(
  fill: (ctx: PrefetchContext) => Promise<void>,
): Promise<DehydratedState> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const qc = new QueryClient();
  try {
    await fill({ qc, userId: session.user.id, now: new Date() });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    // Anything else: the client fetches again and shows the error state (docs/06 section 6).
  }
  return dehydrate(qc);
}
