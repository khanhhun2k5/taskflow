// Shared setup for the MVP-1 API tests. Everything goes through the real API.
import { expect } from "vitest";
import type { BoardDTO, ColumnDTO } from "@/features/boards/schemas";
import type { ProjectDTO } from "@/features/projects/schemas";
import type { TaskDTO, WithWarnings } from "@/features/tasks/schemas";
import { prisma } from "@/server/db";
import { api, type TestUser } from "./api";
import { signUpUser } from "./helpers";

export async function newUser(name?: string): Promise<TestUser> {
  const user = await signUpUser(name);
  return { id: user.id, cookie: user.cookie };
}

export type ProjectFixture = {
  project: ProjectDTO;
  boardId: string;
  todo: ColumnDTO;
  inProgress: ColumnDTO;
  done: ColumnDTO;
};

/** POST /projects, then reads its board: the three default columns of BR-20. */
export async function createProject(user: TestUser, name = "Project"): Promise<ProjectFixture> {
  const created = await api<ProjectDTO>(user, "POST", "/projects", { name });
  expect(created.status).toBe(201);
  const boardId = created.body.boardId ?? "";
  const board = await api<BoardDTO>(user, "GET", `/boards/${boardId}`);
  const [todo, inProgress, done] = board.body.columns;
  return { project: created.body, boardId, todo, inProgress, done };
}

export async function createTask(
  user: TestUser,
  input: Record<string, unknown>,
): Promise<WithWarnings<TaskDTO>> {
  const response = await api<WithWarnings<TaskDTO>>(user, "POST", "/tasks", input);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body;
}

export async function setColumnWip(
  user: TestUser,
  columnId: string,
  wipLimit: number | null,
  wipStrict: boolean,
): Promise<void> {
  const response = await api(user, "PATCH", `/columns/${columnId}`, { wipLimit, wipStrict });
  expect(response.status).toBe(200);
}

/** Every row a user owns, to prove that a forbidden request changed nothing (TC-13, TC-17). */
export async function snapshot(userId: string) {
  const [projects, boards, columns, tasks, labels, taskLabels, activity] = await Promise.all([
    prisma.project.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.board.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.column.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.task.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.label.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.taskLabel.findMany({
      where: { task: { userId } },
      orderBy: [{ taskId: "asc" }, { labelId: "asc" }],
    }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  ]);
  return JSON.parse(
    JSON.stringify({ projects, boards, columns, tasks, labels, taskLabels, activity }),
  ) as unknown;
}
