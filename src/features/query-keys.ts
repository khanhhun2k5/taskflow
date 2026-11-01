import type { QueryKey } from "@tanstack/react-query";

// Every TanStack Query key in one place (ADR-06). Prefixes (`all`) are used to cancel,
// snapshot and invalidate whole groups after a mutation.

/** c1 lists load one page; paging and virtualization arrive with ListView (MVP-1 c2). */
export const LIST_LIMIT = 200;

export type TaskListFilter = { inbox: true } | { projectId: string };

export const queryKeys = {
  tasks: {
    all: ["tasks"] as const,
    lists: ["tasks", "list"] as const,
    list: (filter: TaskListFilter) => ["tasks", "list", filter] as const,
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

/** Optimistically created rows carry a temporary id until the server answers. */
export const TEMP_ID_PREFIX = "temp-";

export function tempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}
