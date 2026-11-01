import { updateLabelSchema } from "@/features/labels/schemas";
import { noContent, withUser } from "@/server/http";
import { deleteLabel, updateLabel } from "@/server/services/labels";

type Params = { id: string };

export const PATCH = withUser<Params>(async (req, { userId, params }) =>
  updateLabel(userId, params.id, updateLabelSchema.parse(await req.json())),
);

export const DELETE = withUser<Params>(async (_req, { userId, params }) => {
  await deleteLabel(userId, params.id);
  return noContent();
});
