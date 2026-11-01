import { checkWip, checkWipMany, wipCount } from "@/features/boards/domain/wip";
import type {
  BulkInput,
  CreateTaskInput,
  ListTasksQuery,
  MoveTaskInput,
  TaskDetailDTO,
  TaskDTO,
  TrashItemDTO,
  UpdateTaskInput,
  Warning,
  WithWarnings,
} from "@/features/tasks/schemas";
import type { Prisma, StatusCategory } from "@/generated/prisma/client";
import { startOfDayInTz } from "@/lib/dates";
import { toPage, type Page } from "@/lib/pagination";
import { prisma, transaction } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  assertActive,
  assertLabelsOwned,
  findOwnedColumn,
  findOwnedProject,
  findOwnedTask,
  landingColumn,
  lockBoardColumns,
  lockedColumn,
  lockTasks,
  wipLimitError,
  wipTasksOf,
  type LockedColumn,
  type LockedTask,
} from "./guards";
import {
  appendTaskKeys,
  columnTasksInOrder,
  insertionIndex,
  stableOrder,
  taskKeyAt,
} from "./positions";
import { logActivity, transitionStatus } from "./status";
import {
  decimalToNumber,
  getUserSettings,
  invalidInput,
  loadTaskDTO,
  taskInclude,
  toTaskDTO,
  type Tx,
} from "./task-dto";

// Task service (docs/05 section 2.2). userId always comes from the session (NFR-10).

/** PATCH semantics: undefined = unchanged, null = cleared. */
const optionalDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

const wipWarnings = (warning: boolean): Warning[] => (warning ? ["WIP_LIMIT_EXCEEDED"] : []);

type PlaceOptions = {
  /** A column id, or "landing": the first column matching the task's status (BR-27). */
  target: string | "landing";
  position?: { beforeId?: string | null; afterId?: string | null };
  /** Extra fields written with the move (e.g. projectId when relocating). */
  extra?: Prisma.TaskUncheckedUpdateInput;
  /** moveTask: the task must still belong to this project once locked. */
  expectProjectId?: string;
};

/**
 * Core of moveTask (BR-01, BR-13, BR-30). Locks the board's columns, then the task row, and
 * decides with the locked values only: WIP check, order key, column, then the status change
 * through transitionStatus (ADR-03). Relocation (PATCH projectId) and restore reuse it.
 */
async function placeIntoColumn(
  tx: Tx,
  userId: string,
  taskId: string,
  boardId: string,
  options: PlaceOptions,
  now: Date,
): Promise<Warning[]> {
  const columns = await lockBoardColumns(tx, boardId);
  const task = (await lockTasks(tx, userId, [taskId])).get(taskId);
  if (!task || task.deletedAt !== null || task.parentId !== null) {
    throw new AppError("NOT_FOUND", "Task not found");
  }
  if (options.expectProjectId !== undefined && task.projectId !== options.expectProjectId) {
    throw invalidInput("columnId", "Column is not on this task's board");
  }
  const column =
    options.target === "landing"
      ? landingColumn(columns, task.statusCategory)
      : lockedColumn(columns, options.target);

  const counted = await wipTasksOf(tx, column.id);
  const wip = checkWip(column, counted, { id: task.id, parentId: null, deleted: false });
  if (!wip.allowed) throw wipLimitError(column, wipCount(counted));

  const list = await columnTasksInOrder(tx, column.id, task.id);
  const index = insertionIndex(list, options.position?.beforeId, options.position?.afterId);
  const order = await taskKeyAt(tx, list, index);
  await tx.task.update({
    where: { id: task.id },
    data: { ...options.extra, columnId: column.id, order },
  });
  await transitionStatus(tx, userId, [task], column.statusCategory, now);
  return wipWarnings(wip.warning);
}

/** Locks the tasks and returns them, NOT_FOUND unless every one is still live. */
async function lockLiveTasks(tx: Tx, userId: string, taskIds: string[]): Promise<LockedTask[]> {
  const locked = await lockTasks(tx, userId, taskIds);
  const tasks = [...new Set(taskIds)].map((id) => locked.get(id));
  if (tasks.some((task) => !task || task.deletedAt !== null)) {
    throw new AppError("NOT_FOUND", "Task not found");
  }
  return tasks.filter((task) => task !== undefined);
}

/** BR-02 + ADR-03: direct status changes, only for tasks without a column (read under lock). */
async function setTaskStatus(
  tx: Tx,
  userId: string,
  taskIds: string[],
  to: StatusCategory,
  now: Date,
): Promise<void> {
  const tasks = await lockLiveTasks(tx, userId, taskIds);
  const onBoard = tasks.filter((task) => task.columnId !== null).map((task) => task.id);
  if (onBoard.length > 0) {
    throw new AppError("TASK_ON_BOARD", "Tasks on a board change status by moving them", {
      taskIds: onBoard,
    });
  }
  await transitionStatus(tx, userId, tasks, to, now);
}

/** BR-10 as settled: parent and its live subtasks get the SAME deletedAt. */
async function softDeleteTasks(tx: Tx, userId: string, taskIds: string[], now: Date) {
  const children = await tx.task.findMany({
    where: { parentId: { in: taskIds }, userId, deletedAt: null },
    select: { id: true },
  });
  const ids = [...new Set([...taskIds, ...children.map((child) => child.id)])];
  await tx.task.updateMany({ where: { id: { in: ids }, userId }, data: { deletedAt: now } });
  await logActivity(
    tx,
    userId,
    ids.map((taskId) => ({ taskId, type: "DELETED" as const })),
    now,
  );
}

// ───────────── Create ─────────────

type Placement = {
  projectId: string | null;
  columnId: string | null;
  parentId: string | null;
  statusCategory: StatusCategory;
  order: string;
  warnings: Warning[];
};

async function placeNewTask(tx: Tx, userId: string, input: CreateTaskInput): Promise<Placement> {
  // Ownership first: an id of another user is 404 even when it would also be inconsistent.
  const project = input.projectId ? await findOwnedProject(tx, userId, input.projectId) : null;

  if (input.parentId) {
    const parent = await findOwnedTask(tx, userId, input.parentId);
    assertActive(parent.project);
    if (parent.parentId !== null) {
      throw new AppError("SUBTASK_DEPTH_EXCEEDED", "Subtasks cannot have subtasks (BR-05)");
    }
    if (input.columnId)
      throw invalidInput("columnId", "Subtasks are not placed on a board (BR-07)");
    if (input.projectId && input.projectId !== parent.projectId) {
      throw invalidInput("projectId", "A subtask belongs to its parent's project (BR-06)");
    }
    const [order] = await appendTaskKeys(tx, { parentId: parent.id }, 1);
    return {
      projectId: parent.projectId,
      columnId: null,
      parentId: parent.id,
      statusCategory: "TODO",
      order,
      warnings: [],
    };
  }

  let boardId: string;
  let projectId: string;
  let pick: (columns: LockedColumn[]) => LockedColumn;
  if (input.columnId) {
    const found = await findOwnedColumn(tx, userId, input.columnId);
    if (project && project.id !== found.project.id) {
      throw invalidInput("columnId", "Column is not on the board of this project");
    }
    assertActive(found.project);
    boardId = found.boardId;
    projectId = found.project.id;
    pick = (columns) => lockedColumn(columns, found.id);
  } else if (project) {
    assertActive(project);
    if (!project.board) throw new AppError("NOT_FOUND", "Board not found");
    boardId = project.board.id;
    projectId = project.id;
    pick = (columns) => landingColumn(columns, "TODO");
  } else {
    const [order] = await appendTaskKeys(
      tx,
      { userId, projectId: null, columnId: null, parentId: null },
      1,
    );
    return {
      projectId: null,
      columnId: null,
      parentId: null,
      statusCategory: "TODO",
      order,
      warnings: [],
    };
  }

  // Lock first, then read the column's status and WIP settings (concurrency rule in guards.ts).
  const column = pick(await lockBoardColumns(tx, boardId));
  const counted = await wipTasksOf(tx, column.id);
  const wip = checkWip(column, counted, { id: "(new)", parentId: null, deleted: false });
  if (!wip.allowed) throw wipLimitError(column, wipCount(counted));
  const [order] = await appendTaskKeys(tx, { columnId: column.id }, 1);
  return {
    projectId,
    columnId: column.id,
    parentId: null,
    statusCategory: column.statusCategory, // initial value from the column (BR-01, BR-27)
    order,
    warnings: wipWarnings(wip.warning),
  };
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
  now: Date,
): Promise<WithWarnings<TaskDTO>> {
  return transaction(async (tx) => {
    const { timezone } = await getUserSettings(tx, userId);
    const labelIds = [...new Set(input.labelIds ?? [])];
    await assertLabelsOwned(tx, userId, labelIds);
    const { warnings, ...placement } = await placeNewTask(tx, userId, input);

    const task = await tx.task.create({
      data: {
        userId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        dueAllDay: input.dueAllDay,
        startAt: input.startAt ? new Date(input.startAt) : null,
        estimate: input.estimate,
        isMilestone: input.isMilestone,
        ...placement,
        completedAt: placement.statusCategory === "DONE" ? now : null, // BR-03
      },
    });
    if (labelIds.length > 0) {
      await tx.taskLabel.createMany({
        data: labelIds.map((labelId) => ({ taskId: task.id, labelId })),
      });
    }
    await logActivity(tx, userId, [{ taskId: task.id, type: "TASK_CREATED" }], now);
    return { ...(await loadTaskDTO(tx, userId, task.id, timezone, now)), warnings };
  });
}

// ───────────── Read ─────────────

// DTO types live in features/tasks/schemas.ts so client code can use them; re-exported here.
export type { ActivityDTO, TaskDetailDTO, TrashItemDTO } from "@/features/tasks/schemas";

export async function getTask(userId: string, taskId: string, now: Date): Promise<TaskDetailDTO> {
  await findOwnedTask(prisma, userId, taskId);
  const { timezone } = await getUserSettings(prisma, userId);
  const [task, subtasks, activity] = await Promise.all([
    loadTaskDTO(prisma, userId, taskId, timezone, now),
    prisma.task.findMany({
      where: { parentId: taskId, userId, deletedAt: null },
      orderBy: [...stableOrder],
      include: taskInclude,
    }),
    prisma.activityLog.findMany({
      where: { taskId, userId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: 20,
    }),
  ]);
  return {
    ...task,
    subtasks: subtasks.map((row) => toTaskDTO(row, timezone, now)),
    activity: activity.map((entry) => ({
      id: entry.id,
      type: entry.type,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      at: entry.at.toISOString(),
    })),
  };
}

const SORTS: Record<ListTasksQuery["sort"], Prisma.TaskOrderByWithRelationInput[]> = {
  order: [...stableOrder],
  dueAt: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  "-dueAt": [{ dueAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  priority: [{ priority: "asc" }, { id: "asc" }], // enum order: URGENT first
  createdAt: [{ createdAt: "asc" }, { id: "asc" }],
  "-createdAt": [{ createdAt: "desc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
};

/** Ids whose title matches `q` without accents or case (BR-82; uses index task_title_trgm). */
async function titleMatches(userId: string, q: string): Promise<string[]> {
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Task"
    WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      AND f_unaccent(lower("title")) LIKE f_unaccent(lower(${pattern}))`;
  return rows.map((row) => row.id);
}

export async function listTasks(
  userId: string,
  query: ListTasksQuery,
  now: Date,
): Promise<Page<TaskDTO>> {
  const { timezone } = await getUserSettings(prisma, userId);
  const filters: Prisma.TaskWhereInput[] = [{ userId, deletedAt: null }];

  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.inbox) filters.push({ projectId: null, courseId: null, parentId: null });
  if (query.status) filters.push({ statusCategory: query.status });
  if (query.priority) filters.push({ priority: query.priority });
  if (query.labelId) filters.push({ labels: { some: { labelId: query.labelId } } });
  if (query.dueFrom) filters.push({ dueAt: { gte: new Date(query.dueFrom) } });
  if (query.dueTo) filters.push({ dueAt: { lte: new Date(query.dueTo) } });
  if (query.sprintId) filters.push({ sprintId: query.sprintId });
  if (query.backlog) filters.push({ sprintId: null, parentId: null });
  if (query.parentId) filters.push({ parentId: query.parentId });
  if (query.topLevel) filters.push({ parentId: null });
  if (query.overdue) {
    // Same rule as isOverdue (BR-04): all-day tasks are overdue from the next local midnight,
    // i.e. when their (local-midnight) dueAt is before today's local midnight.
    filters.push({
      statusCategory: { not: "DONE" },
      OR: [
        { dueAllDay: true, dueAt: { lt: startOfDayInTz(now, timezone) } },
        { dueAllDay: false, dueAt: { lt: now } },
      ],
    });
  }
  if (query.q) filters.push({ id: { in: await titleMatches(userId, query.q) } });

  let skip = 0;
  if (query.cursor) {
    const cursorTask = await prisma.task.count({ where: { id: query.cursor, userId } });
    if (cursorTask === 0) throw invalidInput("cursor", "Unknown cursor");
    // Prisma pages from the cursor row inclusive. Skip it only if it still matches the filters:
    // if it was completed or deleted since the previous page, the first row is a real item.
    const stillMatches = await prisma.task.count({
      where: { AND: [...filters, { id: query.cursor }] },
    });
    skip = stillMatches > 0 ? 1 : 0;
  }

  const rows = await prisma.task.findMany({
    where: { AND: filters },
    orderBy: SORTS[query.sort],
    include: taskInclude,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip } : {}),
  });
  return toPage(
    rows.map((row) => toTaskDTO(row, timezone, now)),
    query.limit,
  );
}

// ───────────── Update ─────────────

/** PATCH projectId: top-level tasks only; subtasks follow (BR-06). */
async function relocate(
  tx: Tx,
  userId: string,
  task: Awaited<ReturnType<typeof findOwnedTask>>,
  projectId: string | null,
  now: Date,
): Promise<Warning[]> {
  if (projectId === task.projectId) return [];
  if (task.parentId !== null) {
    throw invalidInput("projectId", "Subtasks follow their parent's project (BR-06)");
  }

  let warnings: Warning[] = [];
  if (projectId === null) {
    await lockLiveTasks(tx, userId, [task.id]);
    const [order] = await appendTaskKeys(
      tx,
      { userId, projectId: null, columnId: null, parentId: null },
      1,
    );
    await tx.task.update({
      where: { id: task.id },
      data: { projectId: null, columnId: null, order },
    });
  } else {
    const project = await findOwnedProject(tx, userId, projectId);
    assertActive(project);
    if (!project.board) throw new AppError("NOT_FOUND", "Board not found");
    warnings = await placeIntoColumn(
      tx,
      userId,
      task.id,
      project.board.id,
      { target: "landing", extra: { projectId } },
      now,
    );
  }
  await tx.task.updateMany({ where: { parentId: task.id, userId }, data: { projectId } });
  return warnings;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
  now: Date,
): Promise<WithWarnings<TaskDTO>> {
  return transaction(async (tx) => {
    const task = await findOwnedTask(tx, userId, taskId);
    assertActive(task.project);
    const { timezone } = await getUserSettings(tx, userId);

    const warnings =
      input.projectId === undefined ? [] : await relocate(tx, userId, task, input.projectId, now);

    if (input.statusCategory !== undefined) {
      await setTaskStatus(tx, userId, [task.id], input.statusCategory, now);
    }

    const entries = [];
    const nextEstimate = input.estimate;
    if (nextEstimate !== undefined && nextEstimate !== decimalToNumber(task.estimate)) {
      entries.push({
        taskId,
        type: "ESTIMATE_CHANGED" as const,
        fromValue: { estimate: decimalToNumber(task.estimate) },
        toValue: { estimate: nextEstimate },
      });
    }
    const nextDue = optionalDate(input.dueAt);
    if (nextDue !== undefined && nextDue?.getTime() !== task.dueAt?.getTime()) {
      entries.push({
        taskId,
        type: "DUE_CHANGED" as const,
        fromValue: { dueAt: task.dueAt?.toISOString() ?? null },
        toValue: { dueAt: nextDue?.toISOString() ?? null },
      });
    }

    await tx.task.update({
      where: { id: task.id },
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: nextDue,
        dueAllDay: input.dueAllDay,
        startAt: optionalDate(input.startAt),
        estimate: nextEstimate,
        isMilestone: input.isMilestone,
      },
    });

    if (input.labelIds !== undefined) {
      const labelIds = [...new Set(input.labelIds)];
      await assertLabelsOwned(tx, userId, labelIds);
      await tx.taskLabel.deleteMany({ where: { taskId } });
      await tx.taskLabel.createMany({ data: labelIds.map((labelId) => ({ taskId, labelId })) });
    }
    await logActivity(tx, userId, entries, now);
    return { ...(await loadTaskDTO(tx, userId, taskId, timezone, now)), warnings };
  });
}

// ───────────── Move ─────────────

export async function moveTask(
  userId: string,
  taskId: string,
  input: MoveTaskInput,
  now: Date,
): Promise<WithWarnings<TaskDTO>> {
  return transaction(async (tx) => {
    const task = await findOwnedTask(tx, userId, taskId);
    assertActive(task.project);
    if (task.parentId !== null) {
      throw invalidInput("columnId", "Subtasks are not placed on a board (BR-07)");
    }
    const column = await findOwnedColumn(tx, userId, input.columnId);
    if (task.projectId === null || column.project.id !== task.projectId) {
      throw invalidInput("columnId", "Column is not on this task's board");
    }
    if (input.beforeId === task.id || input.afterId === task.id) {
      throw invalidInput("beforeId", "A task cannot be its own neighbour");
    }
    const { timezone } = await getUserSettings(tx, userId);
    const warnings = await placeIntoColumn(
      tx,
      userId,
      task.id,
      column.boardId,
      { target: column.id, position: input, expectProjectId: task.projectId },
      now,
    );
    return { ...(await loadTaskDTO(tx, userId, taskId, timezone, now)), warnings };
  });
}

// ───────────── Delete / restore ─────────────

export async function deleteTask(userId: string, taskId: string, now: Date): Promise<void> {
  await transaction(async (tx) => {
    const task = await findOwnedTask(tx, userId, taskId);
    assertActive(task.project);
    await softDeleteTasks(tx, userId, [task.id], now);
  });
}

export async function restoreTask(
  userId: string,
  taskId: string,
  now: Date,
): Promise<WithWarnings<TaskDTO>> {
  return transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, userId, deletedAt: { not: null } },
      include: {
        project: { select: { id: true, status: true, deletedAt: true, board: true } },
        parent: { select: { deletedAt: true } },
      },
    });
    if (!task || task.deletedAt === null) throw new AppError("NOT_FOUND", "Task not found");
    if (task.parent?.deletedAt || task.project?.deletedAt) {
      throw new AppError("PARENT_DELETED", "Restore the parent task or project first");
    }
    assertActive(task.project);
    const { timezone } = await getUserSettings(tx, userId);

    // Lock the board's columns, then the task, and decide on the locked values.
    const boardId = task.project?.board?.id ?? null;
    const columns = boardId ? await lockBoardColumns(tx, boardId) : [];
    const locked = (await lockTasks(tx, userId, [task.id])).get(task.id);
    if (!locked || locked.deletedAt?.getTime() !== task.deletedAt.getTime()) {
      throw new AppError("NOT_FOUND", "Task not found");
    }

    // A restored top-level task is added back to its column: check WIP before un-deleting.
    let warnings: Warning[] = [];
    const column =
      locked.parentId === null ? columns.find((c) => c.id === locked.columnId) : undefined;
    if (column) {
      const counted = await wipTasksOf(tx, column.id);
      const wip = checkWip(column, counted, { id: task.id, parentId: null, deleted: false });
      if (!wip.allowed) throw wipLimitError(column, wipCount(counted));
      warnings = wipWarnings(wip.warning);
    }

    // BR-10 as settled: bring back only the subtasks deleted together with the parent.
    const children = await tx.task.findMany({
      where: { parentId: task.id, userId, deletedAt: task.deletedAt },
      select: { id: true },
    });
    const ids = [task.id, ...children.map((child) => child.id)];
    await tx.task.updateMany({ where: { id: { in: ids }, userId }, data: { deletedAt: null } });

    // Its column may have been removed meanwhile (FK sets columnId to null): re-home it.
    if (locked.parentId === null && boardId && !column) {
      warnings = await placeIntoColumn(tx, userId, task.id, boardId, { target: "landing" }, now);
    }

    await logActivity(
      tx,
      userId,
      ids.map((id) => ({ taskId: id, type: "RESTORED" as const })),
      now,
    );
    return { ...(await loadTaskDTO(tx, userId, taskId, timezone, now)), warnings };
  });
}

// ───────────── Bulk (BR-31) ─────────────

export type BulkResult = { updated: number; warnings: Warning[] };

/** All-or-nothing: any unknown id or failed rule rolls back the whole batch (TC-17). */
export async function bulkUpdate(userId: string, input: BulkInput, now: Date): Promise<BulkResult> {
  return transaction(async (tx) => {
    const ids = [...new Set(input.ids)];
    const tasks = await tx.task.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      include: { project: { select: { id: true, status: true, deletedAt: true } } },
      orderBy: [...stableOrder],
    });
    if (tasks.length !== ids.length || tasks.some((task) => task.project?.deletedAt)) {
      throw new AppError("NOT_FOUND", "Task not found");
    }
    tasks.forEach((task) => assertActive(task.project));
    const action = input.action;
    let warnings: Warning[] = [];

    switch (action.type) {
      case "move": {
        const found = await findOwnedColumn(tx, userId, action.columnId);
        assertActive(found.project);
        // Columns first, then task rows (ids ascending): no deadlock between opposite orders.
        const column = lockedColumn(await lockBoardColumns(tx, found.boardId), found.id);
        const locked = await lockLiveTasks(tx, userId, ids);
        if (locked.some((task) => task.parentId !== null || task.projectId !== found.project.id)) {
          throw invalidInput("ids", "Every task must be a top-level task of the column's board");
        }
        const counted = await wipTasksOf(tx, column.id);
        const moving = locked.map((task) => ({ id: task.id, parentId: null, deleted: false }));
        const wip = checkWipMany(column, counted, moving);
        if (!wip.allowed) throw wipLimitError(column, wipCount(counted));
        warnings = wipWarnings(wip.warning);

        // Appended in the order the client selected them.
        const incoming = ids.filter(
          (id) => locked.find((task) => task.id === id)?.columnId !== column.id,
        );
        const keys = await appendTaskKeys(tx, { columnId: column.id }, incoming.length);
        for (const [i, id] of incoming.entries()) {
          await tx.task.update({ where: { id }, data: { columnId: column.id, order: keys[i] } });
        }
        await transitionStatus(tx, userId, locked, column.statusCategory, now);
        break;
      }
      case "setStatus":
        await setTaskStatus(tx, userId, ids, action.status, now);
        break;
      case "setPriority":
        await tx.task.updateMany({
          where: { id: { in: ids }, userId },
          data: { priority: action.priority },
        });
        break;
      case "addLabel":
        await assertLabelsOwned(tx, userId, [action.labelId]);
        await tx.taskLabel.createMany({
          data: ids.map((taskId) => ({ taskId, labelId: action.labelId })),
          skipDuplicates: true,
        });
        break;
      case "removeLabel":
        await assertLabelsOwned(tx, userId, [action.labelId]);
        await tx.taskLabel.deleteMany({ where: { taskId: { in: ids }, labelId: action.labelId } });
        break;
      case "setDue": {
        const dueAt = action.dueAt === null ? null : new Date(action.dueAt);
        const changed = tasks.filter((task) => task.dueAt?.getTime() !== dueAt?.getTime());
        await tx.task.updateMany({ where: { id: { in: ids }, userId }, data: { dueAt } });
        await logActivity(
          tx,
          userId,
          changed.map((task) => ({
            taskId: task.id,
            type: "DUE_CHANGED" as const,
            fromValue: { dueAt: task.dueAt?.toISOString() ?? null },
            toValue: { dueAt: dueAt?.toISOString() ?? null },
          })),
          now,
        );
        break;
      }
      case "delete":
        await softDeleteTasks(tx, userId, ids, now);
        break;
    }
    return { updated: ids.length, warnings };
  });
}

// ───────────── Trash ─────────────

const sameInstant = (a: Date | null | undefined, b: Date) => a?.getTime() === b.getTime();

/**
 * Items that can be restored on their own, newest first: projects, tasks not deleted along
 * with their project, subtasks not deleted along with their parent. Kept until P4 (BR-12).
 */
export async function listTrash(
  userId: string,
  query: { cursor?: string; limit: number },
): Promise<Page<TrashItemDTO>> {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
    }),
    prisma.task.findMany({
      where: { userId, deletedAt: { not: null } },
      select: {
        id: true,
        title: true,
        projectId: true,
        deletedAt: true,
        parent: { select: { deletedAt: true } },
        project: { select: { deletedAt: true } },
      },
    }),
  ]);

  const items: (TrashItemDTO & { at: number })[] = [
    ...projects.flatMap((project) =>
      project.deletedAt
        ? [
            {
              type: "project" as const,
              id: project.id,
              title: project.name,
              projectId: null,
              at: project.deletedAt.getTime(),
            },
          ]
        : [],
    ),
    ...tasks.flatMap((task) => {
      if (!task.deletedAt) return [];
      if (sameInstant(task.project?.deletedAt, task.deletedAt)) return [];
      if (sameInstant(task.parent?.deletedAt, task.deletedAt)) return [];
      return [
        {
          type: "task" as const,
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          at: task.deletedAt.getTime(),
        },
      ];
    }),
  ].map((item) => ({ ...item, deletedAt: new Date(item.at).toISOString() }));

  items.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
  let start = 0;
  if (query.cursor) {
    start = items.findIndex((item) => item.id === query.cursor) + 1;
    if (start === 0) throw invalidInput("cursor", "Unknown cursor");
  }
  const page = toPage(items.slice(start, start + query.limit + 1), query.limit);
  return {
    ...page,
    items: page.items.map((item) => ({
      type: item.type,
      id: item.id,
      title: item.title,
      projectId: item.projectId,
      deletedAt: item.deletedAt,
    })),
  };
}
