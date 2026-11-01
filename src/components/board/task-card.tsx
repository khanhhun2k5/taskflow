"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Diamond } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { memo, type ComponentProps } from "react";
import { DueText } from "@/components/task/due-text";
import { PriorityIcon } from "@/components/task/priority-icon";
import { isTempId } from "@/features/query-keys";
import type { TaskDTO } from "@/features/tasks/schemas";

type Props = {
  task: TaskDTO;
  onOpen: (id: string) => void;
  readOnly: boolean;
  /** True right after a drop, so the pointerup of a drag does not open the dialog. */
  justDropped: () => boolean;
};

/** Full name read by screen readers (docs/06 section 4.2). */
export function useCardLabel() {
  const t = useTranslations("Card");
  const tp = useTranslations("Priority");
  const format = useFormatter();
  return (task: TaskDTO) => {
    const parts = [t("title", { title: task.title })];
    if (task.dueAt) {
      parts.push(
        t("due", {
          date: format.dateTime(new Date(task.dueAt), { day: "numeric", month: "long" }),
        }),
      );
    }
    parts.push(t("priority", { priority: tp(task.priority).toLowerCase() }));
    if (task.isOverdue) parts.push(t("overdue"));
    return parts.join(", ");
  };
}

export const CARD_CLASS =
  "flex cursor-grab touch-manipulation flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing aria-disabled:opacity-60";

/** What a card shows (docs/06 section 4.2); also drawn in the DragOverlay while dragging. */
export const TaskCardBody = memo(function TaskCardBody({ task }: { task: TaskDTO }) {
  const t = useTranslations("Task");
  return (
    <>
      <span className="flex items-start gap-1.5">
        {task.isMilestone && <Diamond aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
        <span className="line-clamp-3 break-words">{task.title}</span>
      </span>
      <span
        aria-hidden
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
      >
        <PriorityIcon priority={task.priority} />
        <DueText task={task} />
        {task.estimate !== null && <span className="tabular-nums">{task.estimate}</span>}
        {task.subtaskCount.total > 0 && <span>{t("subtasks", task.subtaskCount)}</span>}
        {task.labels.slice(0, 3).map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.name}
          </span>
        ))}
        {task.labels.length > 3 && <span>+{task.labels.length - 3}</span>}
      </span>
    </>
  );
});

/** The floating copy under the pointer (aria-hidden: the real card stays in the list). */
export function TaskCardOverlay({ task }: { task: TaskDTO }) {
  return (
    <div aria-hidden className={cn(CARD_CLASS, "cursor-grabbing shadow-lg ring-2 ring-ring/40")}>
      <TaskCardBody task={task} />
    </div>
  );
}

/** docs/06 section 4.2: a card on the board. Enter/click opens TaskDialog; Space picks it up. */
export const TaskCard = memo(function TaskCard({ task, onOpen, readOnly, justDropped }: Props) {
  const tb = useTranslations("Board");
  const label = useCardLabel();
  const saving = isTempId(task.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task" },
    disabled: readOnly || saving,
    attributes: { roleDescription: tb("cardRole") },
  });
  const style: ComponentProps<"li">["style"] = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={label(task)}
        aria-disabled={saving || undefined}
        data-task-id={task.id}
        className={CARD_CLASS}
        onClick={() => !saving && !justDropped() && onOpen(task.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !saving) {
            event.preventDefault();
            onOpen(task.id);
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
      >
        <TaskCardBody task={task} />
      </div>
    </li>
  );
});
