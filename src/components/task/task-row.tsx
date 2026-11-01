"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { isTempId } from "@/features/query-keys";
import type { StatusCategoryInput, TaskDTO } from "@/features/tasks/schemas";
import { DueText } from "./due-text";
import { PriorityIcon } from "./priority-icon";

type TaskRowProps = {
  task: TaskDTO;
  onOpen: (id: string) => void;
  /** Tasks without a column toggle their status with a checkbox (BR-02). */
  onToggle?: (id: string, status: StatusCategoryInput) => void;
};

/** A simple task line for the inbox and the static project columns (ListView is c2). */
export function TaskRow({ task, onOpen, onToggle }: TaskRowProps) {
  const t = useTranslations();
  const saving = isTempId(task.id);
  const done = task.statusCategory === "DONE";

  return (
    <li className="flex min-h-12 items-start gap-3 rounded-lg border bg-card px-3 py-2">
      {onToggle && (
        <Checkbox
          className="mt-1"
          checked={done}
          disabled={saving}
          aria-label={t("Task.markDone", { title: task.title })}
          onCheckedChange={(checked) => onToggle(task.id, checked === true ? "DONE" : "TODO")}
        />
      )}
      <button
        type="button"
        disabled={saving}
        aria-busy={saving || undefined}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        onClick={() => onOpen(task.id)}
      >
        <span
          className={cn("line-clamp-3 break-words", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PriorityIcon priority={task.priority} />
            {t(`Priority.${task.priority}`)}
          </span>
          <DueText task={task} />
          {task.subtaskCount.total > 0 && <span>{t("Task.subtasks", task.subtaskCount)}</span>}
          {task.labels.slice(0, 3).map((label) => (
            <span key={label.id} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && <span>+{task.labels.length - 3}</span>}
          {saving && <span className="sr-only">{t("Task.saving")}</span>}
        </span>
      </button>
    </li>
  );
}
