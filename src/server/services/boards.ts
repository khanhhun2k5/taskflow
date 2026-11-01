import { checkWipMany, wipCount } from "@/features/boards/domain/wip";
import type {
  BoardDTO,
  ColumnDTO,
  CreateColumnInput,
  MoveColumnInput,
  UpdateColumnInput,
} from "@/features/boards/schemas";
import type { Warning } from "@/features/tasks/schemas";
import type { Column, StatusCategory } from "@/generated/prisma/client";
import { keyAtIndex } from "@/lib/ordering";
import { prisma, transaction } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  assertActive,
  findOwnedBoard,
  findOwnedColumn,
  lockBoardColumns,
  lockedColumn,
  lockTasks,
  wipLimitError,
  wipTasksOf,
  type LockedTask,
} from "./guards";
import { appendTaskKeys, insertionIndex, stableOrder } from "./positions";
import { transitionStatus } from "./status";
import { getUserSettings, invalidInput, taskInclude, toTaskDTO, type Tx } from "./task-dto";

// Board and column service (docs/05 section 2.3).

function toColumnDTO(column: Column): ColumnDTO {
  return {
    id: column.id,
    name: column.name,
    statusCategory: column.statusCategory,
    order: column.order,
    wipLimit: column.wipLimit,
    wipStrict: column.wipStrict,
  };
}

/** BR-25: a board keeps at least one TODO and one DONE column. */
function assertTodoAndDone(statuses: StatusCategory[]): void {
  if (!statuses.includes("TODO") || !statuses.includes("DONE")) {
    throw new AppError(
      "BOARD_NEEDS_TODO_AND_DONE",
      "A board needs at least one TODO and one DONE column",
    );
  }
}

/**
 * Tasks of a column read under lock (call after lockBoardColumns). Only rows that are still in
 * the column once locked are returned: a task relocated to another board in the meantime is
 * not touched (docs/04 invariant 1).
 */
async function lockColumnTasks(tx: Tx, userId: string, columnId: string): Promise<LockedTask[]> {
  const ids = await tx.task.findMany({ where: { columnId }, select: { id: true } });
  const locked = await lockTasks(
    tx,
    userId,
    ids.map((row) => row.id),
  );
  return [...locked.values()].filter((task) => task.columnId === columnId);
}

/** Order key for a column at a drop position; re-keys the board's columns if needed. */
async function columnKeyAt(
  tx: Tx,
  columns: { id: string; order: string }[],
  position: { beforeId?: string | null; afterId?: string | null },
): Promise<string> {
  const index = insertionIndex(columns, position.beforeId, position.afterId);
  const { key, rekeyed } = keyAtIndex(
    columns.map((column) => column.order),
    index,
  );
  if (rekeyed) {
    for (const [i, column] of columns.entries()) {
      await tx.column.update({ where: { id: column.id }, data: { order: rekeyed[i] } });
    }
  }
  return key;
}

/** GET /boards/:id: columns with their live top-level tasks, in board order (BR-07). */
export async function getBoard(
  userId: string,
  boardId: string,
  query: { sprintId?: string },
  now: Date,
): Promise<BoardDTO> {
  const board = await findOwnedBoard(prisma, userId, boardId);
  const [{ timezone }, columns] = await Promise.all([
    getUserSettings(prisma, userId),
    prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: [...stableOrder],
      include: {
        tasks: {
          where: {
            deletedAt: null,
            parentId: null,
            ...(query.sprintId ? { sprintId: query.sprintId } : {}),
          },
          orderBy: [...stableOrder],
          include: taskInclude,
        },
      },
    }),
  ]);
  return {
    id: board.id,
    projectId: board.projectId,
    courseId: board.courseId,
    columns: columns.map((column) => ({
      ...toColumnDTO(column),
      tasks: column.tasks.map((task) => toTaskDTO(task, timezone, now)),
    })),
  };
}

export async function createColumn(
  userId: string,
  boardId: string,
  input: CreateColumnInput,
): Promise<ColumnDTO> {
  return transaction(async (tx) => {
    const board = await findOwnedBoard(tx, userId, boardId);
    assertActive(board.project);
    const order = await columnKeyAt(tx, await lockBoardColumns(tx, board.id), input);
    const column = await tx.column.create({
      data: {
        userId,
        boardId: board.id,
        name: input.name,
        statusCategory: input.statusCategory,
        wipLimit: input.wipLimit ?? null,
        wipStrict: input.wipStrict ?? false,
        order,
      },
    });
    return toColumnDTO(column);
  });
}

/**
 * PATCH /columns/:id. Changing the status group moves every task of the column (deleted ones
 * included, invariant 1) to the new status in the same transaction (ADR-03, TC-12c).
 */
export async function updateColumn(
  userId: string,
  columnId: string,
  input: UpdateColumnInput,
  now: Date,
): Promise<ColumnDTO> {
  return transaction(async (tx) => {
    const found = await findOwnedColumn(tx, userId, columnId);
    assertActive(found.project);
    // Lock the board's columns before reading anything, so a concurrent move into this column
    // either finishes first (and its task is regrouped here) or waits and sees the new status.
    const columns = await lockBoardColumns(tx, found.boardId);
    const column = lockedColumn(columns, found.id);

    const next = input.statusCategory;
    if (next !== undefined && next !== column.statusCategory) {
      assertTodoAndDone(columns.map((c) => (c.id === column.id ? next : c.statusCategory)));
      await transitionStatus(tx, userId, await lockColumnTasks(tx, userId, column.id), next, now);
    }

    const updated = await tx.column.update({
      where: { id: column.id },
      data: {
        name: input.name,
        statusCategory: next,
        wipLimit: input.wipLimit,
        wipStrict: input.wipStrict,
      },
    });
    return toColumnDTO(updated);
  });
}

export async function moveColumn(
  userId: string,
  columnId: string,
  input: MoveColumnInput,
): Promise<ColumnDTO> {
  return transaction(async (tx) => {
    const column = await findOwnedColumn(tx, userId, columnId);
    assertActive(column.project);
    if (input.beforeId === column.id || input.afterId === column.id) {
      throw invalidInput("beforeId", "A column cannot be its own neighbour");
    }
    const others = (await lockBoardColumns(tx, column.boardId)).filter((c) => c.id !== column.id);
    const order = await columnKeyAt(tx, others, input);
    return toColumnDTO(await tx.column.update({ where: { id: column.id }, data: { order } }));
  });
}

/**
 * DELETE /columns/:id?moveTo= (BR-25, BR-26). Every task of the column (deleted ones too)
 * moves to `moveTo` and takes its status (BR-01); a strict WIP limit there is enforced.
 */
export async function deleteColumn(
  userId: string,
  columnId: string,
  moveTo: string | undefined,
  now: Date,
): Promise<{ warnings: Warning[] }> {
  return transaction(async (tx) => {
    const found = await findOwnedColumn(tx, userId, columnId);
    assertActive(found.project);
    // Ownership of moveTo first (404 for another user's id), then lock the whole board.
    const foundTarget = moveTo === undefined ? null : await findOwnedColumn(tx, userId, moveTo);
    const columns = await lockBoardColumns(tx, found.boardId);
    const column = lockedColumn(columns, found.id);
    assertTodoAndDone(columns.filter((c) => c.id !== column.id).map((c) => c.statusCategory));

    // Read under lock: a task moved in concurrently is either here now or blocked until we commit.
    const tasks = (await lockColumnTasks(tx, userId, column.id)).sort((a, b) =>
      a.id < b.id ? -1 : 1,
    );
    let warnings: Warning[] = [];

    if (foundTarget === null) {
      if (tasks.some((task) => task.deletedAt === null)) {
        throw invalidInput("moveTo", "The column still has tasks; choose a column to move them to");
      }
    } else {
      if (foundTarget.id === column.id) throw invalidInput("moveTo", "Choose another column");
      if (foundTarget.boardId !== column.boardId) {
        throw invalidInput("moveTo", "The target column must be on the same board");
      }
      const target = lockedColumn(columns, foundTarget.id);
      const counted = await wipTasksOf(tx, target.id);
      const wip = checkWipMany(
        target,
        counted,
        tasks.map((task) => ({
          id: task.id,
          parentId: task.parentId,
          deleted: task.deletedAt !== null,
        })),
      );
      if (!wip.allowed) throw wipLimitError(target, wipCount(counted));
      warnings = wip.warning ? ["WIP_LIMIT_EXCEEDED"] : [];

      const keys = await appendTaskKeys(tx, { columnId: target.id }, tasks.length);
      for (const [i, task] of tasks.entries()) {
        await tx.task.update({
          where: { id: task.id },
          data: { columnId: target.id, order: keys[i] },
        });
      }
      await transitionStatus(tx, userId, tasks, target.statusCategory, now);
    }

    // Remaining (soft-deleted) tasks get columnId = null via the FK; restore re-homes them.
    await tx.column.delete({ where: { id: column.id } });
    return { warnings };
  });
}
