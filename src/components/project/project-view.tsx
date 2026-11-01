"use client";

import { useTranslations } from "next-intl";
import { KanbanBoard } from "@/components/board/kanban-board";
import { ErrorState } from "@/components/common/error-state";
import { ListPageSkeleton } from "@/components/common/list-skeleton";
import { PageHeader } from "@/components/common/page-header";
import { ListView } from "@/components/list/list-view";
import { useRegisterShortcuts } from "@/components/shortcuts/shortcuts-provider";
import { QuickAdd } from "@/components/task/quick-add";
import { TaskDialog } from "@/components/task/task-dialog";
import { useTaskParam } from "@/components/task/use-task-param";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBoard } from "@/features/boards/hooks";
import { useProject } from "@/features/projects/hooks";
import { useCreateTask, useMoveTask } from "@/features/tasks/hooks";
import { isApiError } from "@/lib/api-client";
import { ArchivedBanner } from "./archived-banner";
import { ProgressHeader } from "./progress-header";
import { useViewMode, type ViewMode } from "./use-view-mode";

/** /projects/[id]: header, progress, QuickAdd, Kanban | List (docs/06 sections 3, 4.4, 4.5). */
export function ProjectView({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const project = useProject(projectId);
  const { open } = useTaskParam();
  const { view, setView } = useViewMode(projectId);
  const boardId = project.data?.boardId ?? null;
  const board = useBoard(boardId);
  const move = useMoveTask();
  const { create } = useCreateTask({ kind: "project", projectId, boardId });
  const readOnly = project.data?.status === "ARCHIVED";

  useRegisterShortcuts({
    open,
    setView,
    // Shift+D: a card goes to the end of the first DONE column (ADR-03: status = column).
    markDone: (id) => {
      const columns = board.data?.columns ?? [];
      const done = columns.find((c) => c.statusCategory === "DONE");
      const current = columns.find((c) => c.tasks.some((task) => task.id === id));
      if (readOnly || !boardId || !done || current?.id === done.id) return;
      const rest = done.tasks.filter((task) => task.id !== id);
      move.mutate({
        id,
        boardId,
        target: { columnId: done.id, index: rest.length },
        statusCategory: "DONE",
        beforeId: rest.at(-1)?.id ?? null,
        afterId: null,
      });
    },
  });

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
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title={title} description={t(`Projects.${project.data.workflow}`)} />
      {readOnly && <ArchivedBanner projectId={projectId} />}
      <ProgressHeader projectId={projectId} name={project.data.name} />
      {!readOnly && (
        <QuickAdd
          shortcutTarget
          label={t("QuickAdd.label")}
          placeholder={t("QuickAdd.placeholder")}
          onSubmit={create}
        />
      )}
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as ViewMode)}
        className="min-w-0 gap-4"
      >
        <TabsList aria-label={t("View.label")}>
          <TabsTrigger value="kanban" className="min-h-9 px-4">
            {t("View.kanban")}
          </TabsTrigger>
          <TabsTrigger value="list" className="min-h-9 px-4">
            {t("View.list")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="min-w-0">
          {boardId && (
            <KanbanBoard
              boardId={boardId}
              projectId={projectId}
              readOnly={readOnly}
              onOpen={open}
            />
          )}
        </TabsContent>
        <TabsContent value="list" className="min-w-0">
          <ListView
            scope={{ projectId }}
            board={board.data ?? null}
            readOnly={readOnly}
            onOpen={open}
          />
        </TabsContent>
      </Tabs>
      <TaskDialog />
    </div>
  );
}
