import { boardQuerySchema } from "@/features/boards/schemas";
import { queryObject } from "@/lib/pagination";
import { withUser } from "@/server/http";
import { getBoard } from "@/server/services/boards";

export const GET = withUser<{ id: string }>(async (req, { userId, params, now }) =>
  getBoard(userId, params.id, boardQuerySchema.parse(queryObject(req.url)), now),
);
