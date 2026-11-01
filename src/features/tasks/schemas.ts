import { z } from "zod";
import { pageQueryShape, queryBoolean } from "@/lib/pagination";

// docs/05 section 2.2. Objects are strict: unknown keys (userId, courseId before MVP-2,
// sprintId before MVP-3…) are rejected with 400 VALIDATION_ERROR.

export const idSchema = z.string().min(1).max(64);
export const prioritySchema = z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]); // BR-80
export const statusCategorySchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const estimateSchema = z.number().min(0).max(9999);

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).optional(),
  projectId: idSchema.optional(),
  columnId: idSchema.optional(), // none → first TODO column (BR-27)
  parentId: idSchema.optional(),
  priority: prioritySchema.default("MEDIUM"),
  dueAt: z.iso.datetime().optional(),
  dueAllDay: z.boolean().default(true),
  startAt: z.iso.datetime().optional(),
  estimate: estimateSchema.optional(),
  labelIds: z.array(idSchema).max(20).optional(),
  isMilestone: z.boolean().default(false),
});

export const updateTaskSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20_000).nullable().optional(),
    priority: prioritySchema.optional(),
    dueAt: z.iso.datetime().nullable().optional(),
    dueAllDay: z.boolean().optional(),
    startAt: z.iso.datetime().nullable().optional(),
    estimate: estimateSchema.nullable().optional(),
    isMilestone: z.boolean().optional(),
    labelIds: z.array(idSchema).max(20).optional(), // replaces the whole set
    projectId: idSchema.nullable().optional(), // null → inbox; top-level tasks only
    statusCategory: statusCategorySchema.optional(), // tasks without a column only (BR-02)
  })
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required" });

export const moveTaskSchema = z.strictObject({
  columnId: idSchema,
  // Neighbours of the drop position. The server uses beforeId (the task above) if given,
  // otherwise afterId (the task below); both null = end of the column.
  beforeId: idSchema.nullable(),
  afterId: idSchema.nullable(),
});

export const BULK_MAX = 200; // BR-31

export const bulkSchema = z.strictObject({
  ids: z.array(idSchema).min(1).max(BULK_MAX),
  action: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("move"), columnId: idSchema }),
    z.strictObject({ type: z.literal("setStatus"), status: statusCategorySchema }), // no column only
    z.strictObject({ type: z.literal("setPriority"), priority: prioritySchema }),
    z.strictObject({ type: z.literal("addLabel"), labelId: idSchema }),
    z.strictObject({ type: z.literal("removeLabel"), labelId: idSchema }),
    z.strictObject({ type: z.literal("setDue"), dueAt: z.iso.datetime().nullable() }),
    z.strictObject({ type: z.literal("delete") }),
  ]),
});

export const TASK_SORTS = [
  "order",
  "dueAt",
  "-dueAt",
  "priority",
  "createdAt",
  "-createdAt",
  "title",
] as const;

export const listTasksQuerySchema = z.strictObject({
  projectId: idSchema.optional(),
  inbox: queryBoolean.optional(),
  status: statusCategorySchema.optional(),
  priority: prioritySchema.optional(),
  labelId: idSchema.optional(),
  dueFrom: z.iso.datetime().optional(),
  dueTo: z.iso.datetime().optional(),
  overdue: queryBoolean.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sprintId: idSchema.optional(), // read-only filter until MVP-3
  backlog: queryBoolean.optional(),
  parentId: idSchema.optional(),
  sort: z.enum(TASK_SORTS).default("order"),
  ...pageQueryShape,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type BulkInput = z.infer<typeof bulkSchema>;
export type BulkAction = BulkInput["action"];
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type StatusCategoryInput = z.infer<typeof statusCategorySchema>;
export type PriorityInput = z.infer<typeof prioritySchema>;

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  statusCategory: StatusCategoryInput;
  priority: PriorityInput;
  startAt: string | null;
  dueAt: string | null;
  dueAllDay: boolean;
  estimate: number | null;
  isMilestone: boolean;
  completedAt: string | null;
  projectId: string | null;
  courseId: string | null;
  columnId: string | null;
  sprintId: string | null;
  parentId: string | null;
  order: string;
  labels: { id: string; name: string; color: string }[];
  subtaskCount: { total: number; done: number };
  isOverdue: boolean; // BR-04, computed on the server
  updatedAt: string;
};

/** Writes that can exceed a WIP limit in warning mode report it here (BR-29). */
export type Warning = "WIP_LIMIT_EXCEEDED";
export type WithWarnings<T> = T & { warnings: Warning[] };

export const trashQuerySchema = z.strictObject({ ...pageQueryShape });
