import { createLabelSchema, listLabelsQuerySchema } from "@/features/labels/schemas";
import { queryObject } from "@/lib/pagination";
import { created, withUser } from "@/server/http";
import { createLabel, listLabels } from "@/server/services/labels";

export const GET = withUser(async (req, { userId }) =>
  listLabels(userId, listLabelsQuerySchema.parse(queryObject(req.url))),
);

export const POST = withUser(async (req, { userId }) =>
  created(await createLabel(userId, createLabelSchema.parse(await req.json()))),
);
