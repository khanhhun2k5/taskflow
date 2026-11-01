"use client";

import { useTranslations } from "next-intl";
import { useCreateTask, useSetTaskStatus } from "@/features/tasks/hooks";
import type { TaskDetailDTO } from "@/features/tasks/schemas";
import { QuickAdd } from "./quick-add";
import { TaskRow } from "./task-row";

/** Subtasks of a task (BR-05: one level only): add with Enter, tick to complete. */
export function SubtaskList({
  task,
  onOpen,
}: {
  task: TaskDetailDTO;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations();
  const { create } = useCreateTask({ kind: "subtask", parentId: task.id });
  const setStatus = useSetTaskStatus();
  const headingId = `subtasks-${task.id}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-medium">
        {t("TaskDialog.subtasks")}
        {task.subtaskCount.total > 0 && (
          <span className="ml-2 font-normal text-muted-foreground">
            {task.subtaskCount.done}/{task.subtaskCount.total}
          </span>
        )}
      </h3>
      {task.subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("TaskDialog.subtasksEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {task.subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              onOpen={onOpen}
              onToggle={(id, status) => setStatus.mutate({ id, status })}
            />
          ))}
        </ul>
      )}
      <QuickAdd
        label={t("QuickAdd.subtaskLabel")}
        placeholder={t("QuickAdd.subtaskPlaceholder")}
        onSubmit={create}
      />
    </section>
  );
}
