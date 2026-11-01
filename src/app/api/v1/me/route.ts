import { updateMeSchema } from "@/features/users/schemas";
import { withUser } from "@/server/http";
import { getMe, updateMe } from "@/server/services/users";

export const GET = withUser(async (_req, { userId }) => getMe(userId));

export const PATCH = withUser(async (req, { userId }) => {
  const input = updateMeSchema.parse(await req.json()); // ZodError → 400
  return updateMe(userId, input);
});
