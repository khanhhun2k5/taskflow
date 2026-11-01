import { withUser } from "@/server/http";
import { restoreTask } from "@/server/services/tasks";

export const POST = withUser<{ id: string }>(async (_req, { userId, params, now }) =>
  restoreTask(userId, params.id, now),
);
