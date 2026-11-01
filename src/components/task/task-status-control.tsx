"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoard } from "@/features/boards/hooks";
import { useMoveTask, useSetTaskStatus } from "@/features/tasks/hooks";
import type { TaskDTO } from "@/features/tasks/schemas";

/**
 * docs/06 section 4.3: a task on a board changes status by changing column (POST /move,
 * ADR-03); a task without a column (inbox task, subtask) uses a checkbox (BR-02).
 */
export function TaskStatusControl({ task, boardId }: { task: TaskDTO; boardId: string | null }) {
  const t = useTranslations("TaskDialog");
  const id = useId();
  // Decided by the task itself: a task with a column never uses the checkbox (ADR-03), even
  // while the project (and so boardId) is still loading — the select stays disabled meanwhile.
  const onBoard = task.columnId !== null;
  const board = useBoard(onBoard ? boardId : null);
  const move = useMoveTask();
  const setStatus = useSetTaskStatus();

  if (!onBoard) {
    return (
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox
          id={id}
          checked={task.statusCategory === "DONE"}
          onCheckedChange={(checked) =>
            setStatus.mutate({ id: task.id, status: checked === true ? "DONE" : "TODO" })
          }
        />
        <label htmlFor={id} className="text-sm">
          {t("done")}
        </label>
      </div>
    );
  }

  const columns = board.data?.columns ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {t("column")}
      </label>
      <Select
        value={task.columnId ?? undefined}
        disabled={columns.length === 0}
        onValueChange={(columnId) => {
          const column = columns.find((c) => c.id === columnId);
          if (column && boardId && column.id !== task.columnId) {
            move.mutate({ id: task.id, boardId, column });
          }
        }}
      >
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
