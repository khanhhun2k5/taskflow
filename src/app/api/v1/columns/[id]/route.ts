import { deleteColumnQuerySchema, updateColumnSchema } from "@/features/boards/schemas";
import { queryObject } from "@/lib/pagination";
import { withUser } from "@/server/http";
import { deleteColumn, updateColumn } from "@/server/services/boards";

type Params = { id: string };

export const PATCH = withUser<Params>(async (req, { userId, params, now }) =>
  updateColumn(userId, params.id, updateColumnSchema.parse(await req.json()), now),
);

// 200 with { warnings } rather than 204: moving the tasks may exceed a WIP limit (BR-29).
export const DELETE = withUser<Params>(async (req, { userId, params, now }) => {
  const { moveTo } = deleteColumnQuerySchema.parse(queryObject(req.url));
  return deleteColumn(userId, params.id, moveTo, now);
});
