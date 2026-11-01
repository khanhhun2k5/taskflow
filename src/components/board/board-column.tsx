"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { QuickAdd } from "@/components/task/quick-add";
import type { BoardDTO } from "@/features/boards/schemas";
import { isTempId } from "@/features/query-keys";
import { useCreateTask } from "@/features/tasks/hooks";
import { ColumnHeader, type ColumnActions } from "./column-header";
import { TaskCard } from "./task-card";

type Column = BoardDTO["columns"][number];

type Props = {
  column: Column;
  board: BoardDTO;
  projectId: string;
  index: number;
  readOnly: boolean;
  actions: ColumnActions;
  onOpen: (id: string) => void;
  justDropped: () => boolean;
};

/** One Kanban column (docs/06 section 4.4): scrolls on its own, compact QuickAdd at the end. */
export function BoardColumn({
  column,
  board,
  projectId,
  index,
  readOnly,
  actions,
  onOpen,
  justDropped,
}: Props) {
  const t = useTranslations("Board");
  const headingId = `column-${column.id}`;
  // A column just added keeps a temp id until the server answers; it is locked meanwhile.
  const saving = isTempId(column.id);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
    disabled: readOnly || saving,
  });
  const { create } = useCreateTask({
    kind: "project",
    projectId,
    boardId: board.id,
    columnId: column.id,
  });
  const over = column.wipLimit !== null && column.tasks.length > column.wipLimit;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex max-h-[calc(100dvh-14rem)] w-72 shrink-0 flex-col gap-2 rounded-xl border-2 bg-muted/50 p-3",
        over ? "border-red-600 dark:border-red-400" : "border-transparent",
      )}
    >
      <ColumnHeader
        column={column}
        headingId={headingId}
        others={board.columns.filter((c) => c.id !== column.id)}
        canMove={{ left: index > 0, right: index < board.columns.length - 1 }}
        readOnly={readOnly}
        actions={actions}
      />
      <SortableContext
        id={column.id}
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          aria-labelledby={headingId}
          className={cn(
            "flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-0.5",
            isOver && "bg-muted",
          )}
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              readOnly={readOnly}
              justDropped={justDropped}
            />
          ))}
          {column.tasks.length === 0 && (
            <li className="py-3 text-center text-xs text-muted-foreground">{t("empty")}</li>
          )}
        </ul>
      </SortableContext>
      {!readOnly && !saving && (
        <QuickAdd
          compact
          label={t("quickAdd", { column: column.name })}
          placeholder={t("quickAddPlaceholder")}
          onSubmit={create}
        />
      )}
    </section>
  );
}
