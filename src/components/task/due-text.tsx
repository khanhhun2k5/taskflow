"use client";

import { CalendarClock, CircleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { TaskDTO } from "@/features/tasks/schemas";

/** Due date in the user's time zone and locale; overdue = red + icon + text (BR-04, NFR-23). */
export function DueText({ task }: { task: Pick<TaskDTO, "dueAt" | "dueAllDay" | "isOverdue"> }) {
  const t = useTranslations("Task");
  const format = useFormatter();
  if (!task.dueAt) return null;
  const date = format.dateTime(new Date(task.dueAt), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(task.dueAllDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
  return (
    <span
      className={`inline-flex items-center gap-1 ${task.isOverdue ? "font-medium text-red-700 dark:text-red-400" : ""}`}
    >
      {task.isOverdue ? (
        <CircleAlert aria-hidden className="size-3.5" />
      ) : (
        <CalendarClock aria-hidden className="size-3.5" />
      )}
      {t("due", { date })}
      {task.isOverdue && <span>· {t("overdue")}</span>}
    </span>
  );
}
