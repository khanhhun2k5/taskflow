import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { ProjectView } from "@/components/project/project-view";
import { queryKeys } from "@/features/query-keys";
import { getBoard } from "@/server/services/boards";
import { getProject, getProjectProgress } from "@/server/services/projects";
import { prefetch } from "../../_lib/prefetch";

type Props = PageProps<"/projects/[projectId]">;

export default function ProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ProjectData params={params} />
    </Suspense>
  );
}

async function ProjectData({ params }: Pick<Props, "params">) {
  const { projectId } = await params;
  const state = await prefetch(async ({ qc, userId, now }) => {
    // Same data as GET /projects/:id, /projects/:id/progress and /boards/:id.
    const project = await getProject(userId, projectId); // NOT_FOUND → 404 page
    qc.setQueryData(queryKeys.projects.detail(projectId), project);
    const [progress, board] = await Promise.all([
      getProjectProgress(userId, projectId, now),
      project.boardId ? getBoard(userId, project.boardId, {}, now) : null,
    ]);
    qc.setQueryData(queryKeys.projects.progress(projectId), progress);
    if (project.boardId && board) qc.setQueryData(queryKeys.boards.detail(project.boardId), board);
  });
  return (
    <HydrationBoundary state={state}>
      <ProjectView projectId={projectId} />
    </HydrationBoundary>
  );
}
