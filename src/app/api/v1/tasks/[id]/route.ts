import { updateTaskSchema } from "@/features/tasks/schemas";
import { noContent, withUser } from "@/server/http";
import { deleteTask, getTask, updateTask } from "@/server/services/tasks";

type Params = { id: string };

export const GET = withUser<Params>(async (_req, { userId, params, now }) =>
  getTask(userId, params.id, now),
);

export const PATCH = withUser<Params>(async (req, { userId, params, now }) =>
  updateTask(userId, params.id, updateTaskSchema.parse(await req.json()), now),
);

export const DELETE = withUser<Params>(async (_req, { userId, params, now }) => {
  await deleteTask(userId, params.id, now);
  return noContent();
});
