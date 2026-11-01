import { createTaskSchema, listTasksQuerySchema } from "@/features/tasks/schemas";
import { queryObject } from "@/lib/pagination";
import { created, withUser } from "@/server/http";
import { createTask, listTasks } from "@/server/services/tasks";

export const GET = withUser(async (req, { userId, now }) =>
  listTasks(userId, listTasksQuerySchema.parse(queryObject(req.url)), now),
);

export const POST = withUser(async (req, { userId, now }) =>
  created(await createTask(userId, createTaskSchema.parse(await req.json()), now)),
);
