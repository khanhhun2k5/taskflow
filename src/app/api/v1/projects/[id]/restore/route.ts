import { withUser } from "@/server/http";
import { restoreProject } from "@/server/services/projects";

export const POST = withUser<{ id: string }>(async (_req, { userId, params, now }) =>
  restoreProject(userId, params.id, now),
);
