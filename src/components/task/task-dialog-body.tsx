"use client";

import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/features/projects/hooks";
import { useDeleteTask, useTask } from "@/features/tasks/hooks";
import { isApiError } from "@/lib/api-client";
import { ArchivedBanner } from "@/components/project/archived-banner";
import { ActivityList } from "./activity-list";
import { DueField } from "./due-field";
import { LabelPicker } from "./label-picker";
import { SaveIndicator } from "./save-indicator";
import { SubtaskList } from "./subtask-list";
import { TaskDescription } from "./task-description";
import { EstimateField, PriorityField } from "./task-properties";
import { TaskStatusControl } from "./task-status-control";
import { TaskTitleField } from "./task-title-field";
import { useTaskSaver } from "./use-autosave";

type BodyProps = {
  taskId: string;
  onOpen: (id: string) => void;
  /** Shows another task without a history entry (after deleting a subtask). */
  onReplace: (id: string) => void;
  onClose: () => void;
};

/** docs/06 section 4.3: left = title, description, subtasks, activity; right = properties. */
export function TaskDialogBody({ taskId, onOpen, onReplace, onClose }: BodyProps) {
  const t = useTranslations();
  const query = useTask(taskId);
  const project = useProject(query.data?.projectId ?? null);
  const { state, save, revision } = useTaskSaver(taskId);
  const remove = useDeleteTask();

  const header = (
    <div className="flex items-center justify-between gap-2">
      <SaveIndicator state={state} />
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={t("Common.close")}
        onClick={onClose}
      >
        <X aria-hidden />
      </Button>
    </div>
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (query.isError) {
    const missing = isApiError(query.error) && query.error.code === "NOT_FOUND";
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          error={query.error}
          title={missing ? t("TaskDialog.notFound") : undefined}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const task = query.data;
  const boardId = project.data?.boardId ?? null;
  // BR-22: tasks of an archived project are read-only. A disabled <fieldset> disables every
  // field and button inside it natively, so the editors need no read-only mode of their own.
  const readOnly = project.data?.status === "ARCHIVED";
  return (
    <div className="flex flex-col gap-4">
      {header}
      {readOnly && task.projectId && <ArchivedBanner projectId={task.projectId} />}
      <fieldset disabled={readOnly} className="contents">
        <TaskTitleField key={`title-${revision}`} task={task} save={save} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <TaskDescription key={`description-${revision}`} task={task} save={save} />
            {task.parentId === null && <SubtaskList task={task} onOpen={onOpen} />}
            <ActivityList activity={task.activity} />
          </div>
          <aside aria-label={t("TaskDialog.title")} className="flex flex-col gap-4">
            <TaskStatusControl task={task} boardId={boardId} />
            <PriorityField task={task} save={save} />
            <DueField key={`due-${revision}`} task={task} save={save} />
            <EstimateField
              key={`estimate-${revision}`}
              task={task}
              save={save}
              unit={project.data?.estimateUnit ?? null}
            />
            <LabelPicker task={task} save={save} />
            {!readOnly && (
              <Button
                variant="outline"
                className="h-11 text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                onClick={() => {
                  remove.mutate({ id: task.id, parentId: task.parentId });
                  if (task.parentId) onReplace(task.parentId);
                  else onClose();
                }}
              >
                <Trash2 aria-hidden />
                {t("TaskDialog.delete")}
              </Button>
            )}
          </aside>
        </div>
      </fieldset>
    </div>
  );
}
