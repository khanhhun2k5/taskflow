import { z } from "zod";
import { pageQueryShape } from "@/lib/pagination";
import type { TaskDTO } from "@/features/tasks/schemas";

// docs/05 sections 2.3 and 2.4.

export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Expected a hex color like #6366F1");
const workflowSchema = z.enum(["KANBAN", "SCRUM"]);
const estimateUnitSchema = z.enum(["POINTS", "HOURS"]);
export const projectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

const datesInOrder = (input: { startDate?: string | null; endDate?: string | null }) =>
  !input.startDate || !input.endDate || input.startDate <= input.endDate; // ISO dates sort as text

export const createProjectSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2_000).optional(),
    color: colorSchema.optional(),
    workflow: workflowSchema.optional(),
    estimateUnit: estimateUnitSchema.optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .refine(datesInOrder, { message: "endDate must not be before startDate", path: ["endDate"] });

export const updateProjectSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2_000).nullable().optional(),
    color: colorSchema.optional(),
    workflow: workflowSchema.optional(),
    estimateUnit: estimateUnitSchema.optional(),
    status: projectStatusSchema.optional(),
    startDate: z.iso.date().nullable().optional(),
    endDate: z.iso.date().nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required" })
  .refine(datesInOrder, { message: "endDate must not be before startDate", path: ["endDate"] });

export const listProjectsQuerySchema = z.strictObject({
  status: projectStatusSchema.optional(),
  ...pageQueryShape,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export type ProjectDTO = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  workflow: z.infer<typeof workflowSchema>;
  estimateUnit: z.infer<typeof estimateUnitSchema>;
  status: z.infer<typeof projectStatusSchema>;
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;
  boardId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItemDTO = ProjectDTO & {
  progress: number; // P_w when weightedReliable, otherwise P (docs/07 section 3), 0–100
  weightedReliable: boolean; // false → the UI shows P with the "add estimates" hint
  overdueCount: number;
};

export type ProjectProgressDTO = {
  count: number; // P (docs/07 section 2), 0–100, not rounded
  weighted: number; // P_w (docs/07 section 3)
  weightedReliable: boolean; // show P_w only when true (docs/07 section 3)
  done: number;
  total: number;
  overdue: TaskDTO[];
};

/** `?status=` of /projects → filter value; anything unknown means ACTIVE. */
export function projectStatusFromParam(value: string | null | undefined): "ACTIVE" | "ARCHIVED" {
  return value === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
}
