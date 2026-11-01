import { trashQuerySchema } from "@/features/tasks/schemas";
import { queryObject } from "@/lib/pagination";
import { withUser } from "@/server/http";
import { listTrash } from "@/server/services/tasks";

export const GET = withUser(async (req, { userId }) =>
  listTrash(userId, trashQuerySchema.parse(queryObject(req.url))),
);
