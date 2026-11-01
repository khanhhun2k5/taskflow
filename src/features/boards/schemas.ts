import { z } from "zod";
import { idSchema, statusCategorySchema, type TaskDTO } from "@/features/tasks/schemas";

// docs/05 section 2.3.

const wipLimitSchema = z.number().int().min(1).max(999);

export const createColumnSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  statusCategory: statusCategorySchema,
  wipLimit: wipLimitSchema.nullable().optional(),
  wipStrict: z.boolean().optional(),
  beforeId: idSchema.nullable().optional(), // column on the left (null/omitted = append)
  afterId: idSchema.nullable().optional(), // column on the right
});

export const updateColumnSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(60).optional(),
    statusCategory: statusCategorySchema.optional(),
    wipLimit: wipLimitSchema.nullable().optional(),
    wipStrict: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required" });

export const moveColumnSchema = z.strictObject({
  beforeId: idSchema.nullable(),
  afterId: idSchema.nullable(),
});

export const deleteColumnQuerySchema = z.strictObject({ moveTo: idSchema.optional() });
export const boardQuerySchema = z.strictObject({ sprintId: idSchema.optional() });

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;

export type ColumnDTO = {
  id: string;
  name: string;
  statusCategory: z.infer<typeof statusCategorySchema>;
  order: string;
  wipLimit: number | null;
  wipStrict: boolean;
};

export type BoardDTO = {
  id: string;
  projectId: string | null;
  courseId: string | null;
  columns: (ColumnDTO & { tasks: TaskDTO[] })[];
};
