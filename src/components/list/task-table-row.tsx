"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { DueText } from "@/components/task/due-text";
import { PriorityIcon } from "@/components/task/priority-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { isTempId } from "@/features/query-keys";
import type { TaskDTO } from "@/features/tasks/schemas";

type Props = {
  task: TaskDTO;
  rowIndex: number;
  status: string;
  selected: boolean;
  selectable: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: (id: string) => void;
};

/** One ListView row: select, title, status, priority, due, estimate, labels. */
export function TaskTableRow({
  task,
  rowIndex,
  status,
  selected,
  selectable,
  onSelect,
  onOpen,
}: Props) {
  const t = useTranslations();
  const saving = isTempId(task.id);
  return (
    <tr
      aria-rowindex={rowIndex}
      aria-selected={selectable ? selected : undefined}
      className={cn("h-13 border-b", selected && "bg-muted/60")}
    >
      {selectable && (
        <td className="w-10 px-3">
          <Checkbox
            checked={selected}
            disabled={saving}
            aria-label={t("List.selectRow", { title: task.title })}
            onCheckedChange={(checked) => onSelect(task.id, checked === true)}
          />
        </td>
      )}
      <td className="min-w-56 px-3 py-2">
        <button
          type="button"
          data-task-id={task.id}
          disabled={saving}
          className={cn(
            "rounded-sm text-left break-words outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
            task.statusCategory === "DONE" && "text-muted-foreground line-through",
          )}
          onClick={() => onOpen(task.id)}
        >
          {task.title}
        </button>
      </td>
      <td className="px-3 whitespace-nowrap">{status}</td>
      <td className="px-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <PriorityIcon priority={task.priority} />
          {t(`Priority.${task.priority}`)}
        </span>
      </td>
      <td className="px-3 text-xs whitespace-nowrap">
        <DueText task={task} />
      </td>
      <td className="px-3 text-right tabular-nums">{task.estimate ?? ""}</td>
      <td className="px-3">
        <span className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
        </span>
      </td>
    </tr>
  );
}
