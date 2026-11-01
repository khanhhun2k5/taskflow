import { createProjectSchema, listProjectsQuerySchema } from "@/features/projects/schemas";
import { queryObject } from "@/lib/pagination";
import { created, withUser } from "@/server/http";
import { createProject, listProjects } from "@/server/services/projects";

export const GET = withUser(async (req, { userId, now }) =>
  listProjects(userId, listProjectsQuerySchema.parse(queryObject(req.url)), now),
);

export const POST = withUser(async (req, { userId }) =>
  created(await createProject(userId, createProjectSchema.parse(await req.json()))),
);
