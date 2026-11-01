"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/error-state";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { PageHeader } from "@/components/common/page-header";
import { QuickAdd } from "@/components/task/quick-add";
import { TaskDialog } from "@/components/task/task-dialog";
import { useTaskParam } from "@/components/task/use-task-param";
import { useProject } from "@/features/projects/hooks";
import { useCreateTask } from "@/features/tasks/hooks";
import { isApiError } from "@/lib/api-client";
import { ProgressHeader } from "./progress-header";
import { StaticBoard } from "./static-board";

/** /projects/[id] for c1: header, ProgressHeader, QuickAdd and the columns (read-only). */
export function ProjectView({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const project = useProject(projectId);
  const { open } = useTaskParam();
  const boardId = project.data?.boardId ?? null;
  const { create } = useCreateTask({ kind: "project", projectId, boardId });

  if (project.isPending) return <ListPageSkeleton />;
  if (project.isError) {
    const missing = isApiError(project.error) && project.error.code === "NOT_FOUND";
    return (
      <div className="p-4 md:p-6">
        <ErrorState
          error={project.error}
          title={missing ? t("Project.notFound") : undefined}
          onRetry={() => void project.refetch()}
        />
      </div>
    );
  }

  const archived = project.data.status === "ARCHIVED";
  const title = (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: project.data.color }}
      />
      {project.data.name}
    </span>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title={title}
        description={
          archived ? t("Project.archivedNotice") : t(`Projects.${project.data.workflow}`)
        }
      />
      <ProgressHeader projectId={projectId} name={project.data.name} />
      {!archived && (
        <QuickAdd
          label={t("QuickAdd.label")}
          placeholder={t("QuickAdd.placeholder")}
          onSubmit={create}
        />
      )}
      {boardId && <StaticBoard boardId={boardId} onOpen={open} />}
      <TaskDialog />
    </div>
  );
}
