import { bulkSchema } from "@/features/tasks/schemas";
import { withUser } from "@/server/http";
import { bulkUpdate } from "@/server/services/tasks";

export const POST = withUser(async (req, { userId, now }) =>
  bulkUpdate(userId, bulkSchema.parse(await req.json()), now),
);
