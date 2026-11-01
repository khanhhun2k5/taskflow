import type { TaskListParams, TaskScope } from "@/features/query-keys";
import { endOfZonedDayIso, zonedToUtcIso } from "@/lib/dates";
import { prioritySchema, statusCategorySchema, TASK_SORTS } from "./schemas";

// ListView filters live in the URL (docs/06 section 4.5): parsed here for the client hooks
// and the server prefetch, so both build the same query key and the same API query.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Readable = { get(name: string): string | null };

/** URL search params → filters; unknown or invalid values are dropped. */
export function parseListParams(search: Readable): TaskListParams {
  const params: TaskListParams = {};
  const status = statusCategorySchema.safeParse(search.get("status"));
  if (status.success) params.status = status.data;
  const priority = prioritySchema.safeParse(search.get("priority"));
  if (priority.success) params.priority = priority.data;
  const label = search.get("label");
  if (label && label.length <= 64) params.labelId = label;
  const from = search.get("from");
  if (from && DAY.test(from)) params.from = from;
  const to = search.get("to");
  if (to && DAY.test(to)) params.to = to;
  if (search.get("overdue") === "true") params.overdue = true;
  const q = search.get("q")?.trim();
  if (q) params.q = q.slice(0, 100);
  const sort = search.get("sort");
  if (sort && (TASK_SORTS as readonly string[]).includes(sort)) {
    params.sort = sort as NonNullable<TaskListParams["sort"]>;
  }
  return params;
}

const URL_NAMES: Record<keyof TaskListParams, string> = {
  status: "status",
  priority: "priority",
  labelId: "label",
  from: "from",
  to: "to",
  overdue: "overdue",
  q: "q",
  sort: "sort",
};

/** Filters → URL search params, keeping unrelated params (view, task…). */
export function writeListParams(current: string, params: TaskListParams): string {
  const search = new URLSearchParams(current);
  for (const name of Object.values(URL_NAMES)) search.delete(name);
  for (const [key, value] of Object.entries(params) as [keyof TaskListParams, unknown][]) {
    if (value !== undefined && value !== "") search.set(URL_NAMES[key], String(value));
  }
  return search.toString();
}

export function hasFilters(params: TaskListParams): boolean {
  return Object.entries(params).some(([key, value]) => key !== "sort" && value !== undefined);
}

/**
 * GET /tasks query for a list (strings, as in a URL). Day bounds become instants in the
 * user's time zone: from = 00:00, to = the last millisecond of that day (NFR-31).
 */
export function toListQuery(
  scope: TaskScope,
  params: TaskListParams,
  tz: string,
): Record<string, string> {
  const query: Record<string, string> =
    "inbox" in scope ? { inbox: "true" } : { projectId: scope.projectId, topLevel: "true" };
  if (params.status) query.status = params.status;
  if (params.priority) query.priority = params.priority;
  if (params.labelId) query.labelId = params.labelId;
  if (params.from) query.dueFrom = zonedToUtcIso(params.from, null, tz);
  if (params.to) query.dueTo = endOfZonedDayIso(params.to, tz);
  if (params.overdue) query.overdue = "true";
  if (params.q) query.q = params.q;
  if (params.sort) query.sort = params.sort;
  return query;
}
