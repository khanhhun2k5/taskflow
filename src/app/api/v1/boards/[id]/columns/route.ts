import { createColumnSchema } from "@/features/boards/schemas";
import { created, withUser } from "@/server/http";
import { createColumn } from "@/server/services/boards";

export const POST = withUser<{ id: string }>(async (req, { userId, params }) =>
  created(await createColumn(userId, params.id, createColumnSchema.parse(await req.json()))),
);
