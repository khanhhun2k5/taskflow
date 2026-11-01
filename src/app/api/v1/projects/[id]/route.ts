import { updateProjectSchema } from "@/features/projects/schemas";
import { noContent, withUser } from "@/server/http";
import { deleteProject, getProject, updateProject } from "@/server/services/projects";

type Params = { id: string };

export const GET = withUser<Params>(async (_req, { userId, params }) =>
  getProject(userId, params.id),
);

export const PATCH = withUser<Params>(async (req, { userId, params }) =>
  updateProject(userId, params.id, updateProjectSchema.parse(await req.json())),
);

export const DELETE = withUser<Params>(async (_req, { userId, params, now }) => {
  await deleteProject(userId, params.id, now);
  return noContent();
});
