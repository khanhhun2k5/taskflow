import type { WipColumn, WipTask } from "@/features/boards/domain/wip";
import { Prisma, type StatusCategory } from "@/generated/prisma/client";
import { AppError } from "@/server/errors";
import type { Db, Tx } from "./task-dto";

// Ownership, archive and locking helpers shared by the services. Every lookup filters by
// userId (NFR-10); anything missing or owned by someone else is NOT_FOUND (docs/05 1.1).

const projectState = { select: { id: true, status: true, deletedAt: true } } as const;

type ProjectState = { id: string; status: "ACTIVE" | "ARCHIVED"; deletedAt: Date | null };

/** BR-22: writes into an archived project are rejected. */
export function assertActive(project: ProjectState | null): void {
  if (project?.status === "ARCHIVED") {
    throw new AppError("PROJECT_ARCHIVED", "Project is archived", { projectId: project.id });
  }
}

export async function findOwnedProject(db: Db, userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: { board: { select: { id: true } } },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found");
  return project;
}

export async function findOwnedColumn(db: Db, userId: string, columnId: string) {
  const column = await db.column.findFirst({
    where: { id: columnId, userId },
    include: { board: { select: { id: true, projectId: true, project: projectState } } },
  });
  // Boards without a live project (course boards arrive in MVP-2) are not reachable yet.
  if (!column || !column.board.project || column.board.project.deletedAt !== null) {
    throw new AppError("NOT_FOUND", "Column not found");
  }
  return { ...column, project: column.board.project };
}

export async function findOwnedBoard(db: Db, userId: string, boardId: string) {
  const board = await db.board.findFirst({
    where: { id: boardId, userId },
    include: { project: projectState },
  });
  if (!board || !board.project || board.project.deletedAt !== null) {
    throw new AppError("NOT_FOUND", "Board not found");
  }
  return { ...board, project: board.project };
}

/** A live (not soft-deleted) task of the user, with the state of its project. */
export async function findOwnedTask(db: Db, userId: string, taskId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, userId, deletedAt: null },
    include: { project: projectState },
  });
  if (!task || (task.project && task.project.deletedAt !== null)) {
    throw new AppError("NOT_FOUND", "Task not found");
  }
  return task;
}

export async function assertLabelsOwned(db: Db, userId: string, labelIds: string[]): Promise<void> {
  const unique = [...new Set(labelIds)];
  if (unique.length === 0) return;
  const count = await db.label.count({ where: { id: { in: unique }, userId } });
  if (count !== unique.length) throw new AppError("NOT_FOUND", "Label not found");
}

// ───────────── Locking (concurrency) ─────────────
// Rule for every write that touches a board: (1) lock ALL columns of that board, (2) then lock
// the task rows involved, each in ascending id order, and (3) use only values read under those
// locks. The fixed order (columns before tasks, ids ascending) prevents deadlocks; reading after
// locking prevents stale status and WIP decisions (docs/03 ADR-03, TC-21b).

export type LockedColumn = {
  id: string;
  boardId: string;
  name: string;
  statusCategory: StatusCategory;
  order: string;
  wipLimit: number | null;
  wipStrict: boolean;
};

/** SELECT … FOR UPDATE on every column of a board; returns them in board order. */
export async function lockBoardColumns(tx: Tx, boardId: string): Promise<LockedColumn[]> {
  const rows = await tx.$queryRaw<LockedColumn[]>`
    SELECT "id", "boardId", "name", "statusCategory"::text AS "statusCategory", "order",
           "wipLimit", "wipStrict"
    FROM "Column" WHERE "boardId" = ${boardId} ORDER BY "id" FOR UPDATE`;
  return rows.sort((a, b) =>
    a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : 1,
  );
}

/** The locked column `columnId`; NOT_FOUND if it was deleted meanwhile. */
export function lockedColumn(columns: LockedColumn[], columnId: string): LockedColumn {
  const column = columns.find((c) => c.id === columnId);
  if (!column) throw new AppError("NOT_FOUND", "Column not found");
  return column;
}

/** First column with `status`, falling back to the first TODO column (BR-27). */
export function landingColumn(columns: LockedColumn[], status: StatusCategory): LockedColumn {
  const column =
    columns.find((c) => c.statusCategory === status) ??
    columns.find((c) => c.statusCategory === "TODO");
  if (!column) throw new AppError("BOARD_NEEDS_TODO_AND_DONE", "Board has no TODO column");
  return column;
}

export type LockedTask = {
  id: string;
  statusCategory: StatusCategory;
  columnId: string | null;
  parentId: string | null;
  projectId: string | null;
  deletedAt: Date | null;
};

/** SELECT … FOR UPDATE on tasks of `userId`; call after lockBoardColumns. */
export async function lockTasks(
  tx: Tx,
  userId: string,
  taskIds: string[],
): Promise<Map<string, LockedTask>> {
  const ids = [...new Set(taskIds)].sort();
  if (ids.length === 0) return new Map();
  const rows = await tx.$queryRaw<LockedTask[]>`
    SELECT "id", "statusCategory"::text AS "statusCategory", "columnId", "parentId",
           "projectId", "deletedAt"
    FROM "Task" WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(ids)})
    ORDER BY "id" FOR UPDATE`;
  return new Map(rows.map((row) => [row.id, row]));
}

/** Tasks counted for WIP in a column (call after lockBoardColumns). */
export async function wipTasksOf(tx: Tx, columnId: string): Promise<WipTask[]> {
  const rows = await tx.task.findMany({
    where: { columnId },
    select: { id: true, parentId: true, deletedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    deleted: row.deletedAt !== null,
  }));
}

export function wipLimitError(column: WipColumn & { id: string; name: string }, current: number) {
  return new AppError(
    "WIP_LIMIT_EXCEEDED",
    `Column "${column.name}" has reached its limit of ${column.wipLimit} tasks.`,
    { columnId: column.id, limit: column.wipLimit, current },
  );
}
