import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGridSkeleton, ProjectsView } from "@/components/project/projects-view";
import { listProjectsQuerySchema, projectStatusFromParam } from "@/features/projects/schemas";
import { LIST_LIMIT, queryKeys } from "@/features/query-keys";
import { listProjects } from "@/server/services/projects";
import { prefetch } from "../_lib/prefetch";

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsData searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectsData({ searchParams }: Pick<PageProps<"/projects">, "searchParams">) {
  const raw = (await searchParams).status;
  const status = projectStatusFromParam(typeof raw === "string" ? raw : null);
  const state = await prefetch(async ({ qc, userId, now }) => {
    // Same query as GET /api/v1/projects?status=…&limit=200 (features/projects/hooks.ts).
    const query = listProjectsQuerySchema.parse({ status, limit: String(LIST_LIMIT) });
    qc.setQueryData(queryKeys.projects.list(status), await listProjects(userId, query, now));
  });
  return (
    <HydrationBoundary state={state}>
      <ProjectsView />
    </HydrationBoundary>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6" aria-busy="true">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-32" />
      </div>
      <Skeleton className="h-11 w-56" />
      <ProjectGridSkeleton />
    </div>
  );
}
