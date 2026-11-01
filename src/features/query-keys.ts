import type { QueryKey } from "@tanstack/react-query";

// Every TanStack Query key in one place (ADR-06). Prefixes (`all`, `lists`) are used to
// cancel, snapshot and invalidate whole groups after a mutation.

/** Page size of infinite lists (docs/05 section 1: default 50). */
export const PAGE_SIZE = 50;

/** Which tasks a list shows. Keys match partially, so { inbox: true } finds every inbox list. */
export type TaskScope = { inbox: true } | { projectId: string };

/** List filters and sort as kept in the URL (dates are "YYYY-MM-DD" in User.timezone). */
export type TaskListParams = {
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  labelId?: string;
  from?: string;
  to?: string;
  overdue?: true;
  q?: string;
  sort?: "order" | "dueAt" | "-dueAt" | "priority" | "createdAt" | "-createdAt" | "title";
};

export const queryKeys = {
  tasks: {
    all: ["tasks"] as const,
    lists: ["tasks", "list"] as const,
    scope: (scope: TaskScope) => ["tasks", "list", scope] as const,
    list: (scope: TaskScope, params: TaskListParams = {}) =>
      ["tasks", "list", scope, params] as const,
    details: ["tasks", "detail"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  projects: {
    all: ["projects"] as const,
    lists: ["projects", "list"] as const,
    list: (status: "ACTIVE" | "ARCHIVED") => ["projects", "list", status] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    progress: (id: string) => ["projects", "progress", id] as const,
  },
  boards: {
    all: ["boards"] as const,
    detail: (id: string) => ["boards", id] as const,
  },
  labels: { all: ["labels"] as const },
  trash: { all: ["trash"] as const },
} satisfies Record<string, Record<string, QueryKey | ((...args: never[]) => QueryKey)>>;

/** Project and label lists stay single-page (few rows); they load this many. */
export const LIST_LIMIT = 200;

/** Optimistically created rows carry a temporary id until the server answers. */
export const TEMP_ID_PREFIX = "temp-";

export function tempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}
