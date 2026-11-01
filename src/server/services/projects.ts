import {
  countProgress,
  weightedProgress,
  type ProgressItem,
} from "@/features/progress/domain/progress";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  ProjectDTO,
  ProjectListItemDTO,
  ProjectProgressDTO,
  UpdateProjectInput,
} from "@/features/projects/schemas";
import type { Project } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/locales";
import { formatIsoDate, isOverdue, parseIsoDate } from "@/lib/dates";
import { keysForAppend } from "@/lib/ordering";
import { toPage, type Page } from "@/lib/pagination";
import { prisma, transaction } from "@/server/db";
import { AppError } from "@/server/errors";
import en from "../../../messages/en.json";
import vi from "../../../messages/vi.json";
import { assertActive, findOwnedProject } from "./guards";
import { logActivity } from "./status";
import { decimalToNumber, getUserSettings, invalidInput, taskInclude, toTaskDTO } from "./task-dto";

// Project service (docs/05 sections 2.3, 2.4).

const MESSAGES = { vi, en } satisfies Record<Locale, typeof vi>;

/** BR-20: three default columns, named in the user's language (User.locale). */
function defaultColumns(locale: Locale) {
  const names = MESSAGES[locale].Board.defaultColumns;
  const [todo, inProgress, done] = keysForAppend(3);
  return [
    { name: names.todo, statusCategory: "TODO" as const, order: todo },
    { name: names.inProgress, statusCategory: "IN_PROGRESS" as const, order: inProgress },
    { name: names.done, statusCategory: "DONE" as const, order: done },
  ];
}

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : parseIsoDate(value);

function toProjectDTO(project: Project & { board: { id: string } | null }): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    workflow: project.workflow,
    estimateUnit: project.estimateUnit,
    status: project.status,
    startDate: project.startDate ? formatIsoDate(project.startDate) : null,
    endDate: project.endDate ? formatIsoDate(project.endDate) : null,
    boardId: project.board?.id ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

const progressSelect = {
  id: true,
  projectId: true,
  parentId: true,
  statusCategory: true,
  estimate: true,
  isMilestone: true,
  dueAt: true,
  dueAllDay: true,
} as const;

type ProgressRow = {
  id: string;
  parentId: string | null;
  statusCategory: ProgressItem["statusCategory"];
  estimate: Parameters<typeof decimalToNumber>[0];
  isMilestone: boolean;
};

/** Decimal → number happens here, never in the domain (docs/04). */
const toProgressItem = (row: ProgressRow): ProgressItem => ({
  id: row.id,
  parentId: row.parentId,
  statusCategory: row.statusCategory,
  estimate: decimalToNumber(row.estimate),
  isMilestone: row.isMilestone,
  deleted: false, // callers only load live tasks
});

/** docs/07 section 3: show P_w when enough tasks are estimated, otherwise P. */
function displayedProgress(items: ProgressItem[]): { progress: number; weightedReliable: boolean } {
  const weighted = weightedProgress(items);
  return weighted.reliable
    ? { progress: weighted.percent, weightedReliable: true }
    : { progress: countProgress(items).percent, weightedReliable: false };
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectDTO> {
  return transaction(async (tx) => {
    const { locale } = await getUserSettings(tx, userId);
    const project = await tx.project.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        color: input.color,
        workflow: input.workflow,
        estimateUnit: input.estimateUnit,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        board: {
          create: {
            userId,
            columns: { create: defaultColumns(locale).map((column) => ({ ...column, userId })) },
          },
        },
      },
      include: { board: { select: { id: true } } },
    });
    return toProjectDTO(project);
  });
}

export async function listProjects(
  userId: string,
  query: ListProjectsQuery,
  now: Date,
): Promise<Page<ProjectListItemDTO>> {
  const where = { userId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };
  let skip = 0;
  if (query.cursor) {
    const exists = await prisma.project.count({ where: { id: query.cursor, userId } });
    if (exists === 0) throw invalidInput("cursor", "Unknown cursor");
    // Skip the cursor row only if it still matches (it may have been archived or deleted
    // since the previous page); see listTasks.
    skip = (await prisma.project.count({ where: { ...where, id: query.cursor } })) > 0 ? 1 : 0;
  }
  const [{ timezone }, projects] = await Promise.all([
    getUserSettings(prisma, userId),
    prisma.project.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { board: { select: { id: true } } },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip } : {}),
    }),
  ]);
  const page = toPage(projects, query.limit);

  // One query for the tasks of every project on the page (no N+1, NFR-05).
  const tasks = await prisma.task.findMany({
    where: { userId, deletedAt: null, projectId: { in: page.items.map((project) => project.id) } },
    select: progressSelect,
  });
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((project) => {
      const own = tasks.filter((task) => task.projectId === project.id);
      return {
        ...toProjectDTO(project),
        ...displayedProgress(own.map(toProgressItem)),
        overdueCount: own.filter((task) =>
          isOverdue(task.dueAt, task.dueAllDay, task.statusCategory, now, timezone),
        ).length,
      };
    }),
  };
}

export async function getProject(userId: string, projectId: string): Promise<ProjectDTO> {
  return toProjectDTO(await findOwnedProject(prisma, userId, projectId));
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDTO> {
  return transaction(async (tx) => {
    const project = await findOwnedProject(tx, userId, projectId);
    // BR-22: an archived project only accepts a PATCH that un-archives it.
    if (input.status !== "ACTIVE") assertActive(project);
    const updated = await tx.project.update({
      where: { id: project.id },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        workflow: input.workflow,
        estimateUnit: input.estimateUnit,
        status: input.status,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
      },
      include: { board: { select: { id: true } } },
    });
    const start = updated.startDate?.getTime();
    const end = updated.endDate?.getTime();
    if (start !== undefined && end !== undefined && start > end) {
      throw invalidInput("endDate", "endDate must not be before startDate");
    }
    return toProjectDTO(updated);
  });
}

/** BR-11 with the BR-10 rule: the project and its live tasks share one deletedAt. */
export async function deleteProject(userId: string, projectId: string, now: Date): Promise<void> {
  await transaction(async (tx) => {
    const project = await findOwnedProject(tx, userId, projectId);
    const tasks = await tx.task.findMany({
      where: { projectId: project.id, userId, deletedAt: null },
      select: { id: true },
    });
    await tx.project.update({ where: { id: project.id }, data: { deletedAt: now } });
    await tx.task.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: { deletedAt: now },
    });
    await logActivity(
      tx,
      userId,
      tasks.map((task) => ({ taskId: task.id, type: "DELETED" as const })),
      now,
    );
  });
}

export async function restoreProject(
  userId: string,
  projectId: string,
  now: Date,
): Promise<ProjectDTO> {
  return transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, userId, deletedAt: { not: null } },
    });
    if (!project?.deletedAt) throw new AppError("NOT_FOUND", "Project not found");
    const tasks = await tx.task.findMany({
      where: { projectId: project.id, userId, deletedAt: project.deletedAt },
      select: { id: true },
    });
    await tx.task.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: { deletedAt: null },
    });
    const restored = await tx.project.update({
      where: { id: project.id },
      data: { deletedAt: null },
      include: { board: { select: { id: true } } },
    });
    await logActivity(
      tx,
      userId,
      tasks.map((task) => ({ taskId: task.id, type: "RESTORED" as const })),
      now,
    );
    return toProjectDTO(restored);
  });
}

/** GET /projects/:id/progress (docs/05 section 2.4, docs/07). */
export async function getProjectProgress(
  userId: string,
  projectId: string,
  now: Date,
): Promise<ProjectProgressDTO> {
  const project = await findOwnedProject(prisma, userId, projectId);
  const [{ timezone }, rows] = await Promise.all([
    getUserSettings(prisma, userId),
    prisma.task.findMany({
      where: { projectId: project.id, userId, deletedAt: null },
      include: taskInclude,
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    }),
  ]);
  const items = rows.map(toProgressItem);
  const count = countProgress(items);
  const weighted = weightedProgress(items);
  return {
    count: count.percent,
    weighted: weighted.percent,
    weightedReliable: weighted.reliable,
    done: count.done,
    total: count.total,
    overdue: rows.map((row) => toTaskDTO(row, timezone, now)).filter((task) => task.isOverdue),
  };
}
