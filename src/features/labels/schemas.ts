import { z } from "zod";
import { colorSchema } from "@/features/projects/schemas";
import { pageQueryShape } from "@/lib/pagination";

// docs/05 section 2.8, BR-81.

export const createLabelSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  color: colorSchema.optional(),
});

export const updateLabelSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(40).optional(),
    color: colorSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required" });

export const listLabelsQuerySchema = z.strictObject({ ...pageQueryShape });

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type LabelDTO = { id: string; name: string; color: string };
