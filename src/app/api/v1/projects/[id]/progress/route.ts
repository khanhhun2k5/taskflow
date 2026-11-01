import { withUser } from "@/server/http";
import { getProjectProgress } from "@/server/services/projects";

export const GET = withUser<{ id: string }>(async (_req, { userId, params, now }) =>
  getProjectProgress(userId, params.id, now),
);
