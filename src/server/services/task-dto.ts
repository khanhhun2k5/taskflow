import type { TaskDTO } from "@/features/tasks/schemas";
import { Prisma } from "@/generated/prisma/client";
import { isOverdue } from "@/lib/dates";
import { resolveLocale, type Locale } from "@/i18n/locales";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";

export type Tx = Prisma.TransactionClient;
export type Db = typeof prisma | Tx;

/** Relations needed for a TaskDTO, loaded in the same query (no N+1, NFR-05). */
export const taskInclude = {
  labels: {
    select: { label: { select: { id: true, name: true, color: true } } },
    orderBy: { label: { name: "asc" } },
  },
  subtasks: { where: { deletedAt: null }, select: { statusCategory: true } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export type UserSettings = { timezone: string; locale: Locale };

export async function getUserSettings(db: Db, userId: string): Promise<UserSettings> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true, locale: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return { timezone: user.timezone, locale: resolveLocale(user.locale) };
}

/** Prisma Decimal → number at the service boundary; domain code only sees numbers (docs/04). */
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

/** docs/05 section 1.2. `isOverdue` uses the user's time zone and the request's `now` (BR-04). */
export function toTaskDTO(row: TaskRow, timezone: string, now: Date): TaskDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    statusCategory: row.statusCategory,
    priority: row.priority,
    startAt: iso(row.startAt),
    dueAt: iso(row.dueAt),
    dueAllDay: row.dueAllDay,
    estimate: decimalToNumber(row.estimate),
    isMilestone: row.isMilestone,
    completedAt: iso(row.completedAt),
    projectId: row.projectId,
    courseId: row.courseId,
    columnId: row.columnId,
    sprintId: row.sprintId,
    parentId: row.parentId,
    order: row.order,
    labels: row.labels.map(({ label }) => label),
    subtaskCount: {
      total: row.subtasks.length,
      done: row.subtasks.filter((subtask) => subtask.statusCategory === "DONE").length,
    },
    isOverdue: isOverdue(row.dueAt, row.dueAllDay, row.statusCategory, now, timezone),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadTaskDTO(
  db: Db,
  userId: string,
  taskId: string,
  timezone: string,
  now: Date,
): Promise<TaskDTO> {
  const row = await db.task.findFirst({
    where: { id: taskId, userId },
    include: taskInclude,
  });
  if (!row) throw new AppError("NOT_FOUND", "Task not found");
  return toTaskDTO(row, timezone, now);
}

/** 400 VALIDATION_ERROR for business-level input problems, same shape as Zod errors. */
export function invalidInput(path: string, message: string): AppError {
  return new AppError("VALIDATION_ERROR", "Invalid input", [{ path, message }]);
}
