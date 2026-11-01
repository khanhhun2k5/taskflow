import { moveTaskSchema } from "@/features/tasks/schemas";
import { withUser } from "@/server/http";
import { moveTask } from "@/server/services/tasks";

export const POST = withUser<{ id: string }>(async (req, { userId, params, now }) =>
  moveTask(userId, params.id, moveTaskSchema.parse(await req.json()), now),
);
