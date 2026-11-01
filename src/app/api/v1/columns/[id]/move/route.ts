import { moveColumnSchema } from "@/features/boards/schemas";
import { withUser } from "@/server/http";
import { moveColumn } from "@/server/services/boards";

export const POST = withUser<{ id: string }>(async (req, { userId, params }) =>
  moveColumn(userId, params.id, moveColumnSchema.parse(await req.json())),
);
