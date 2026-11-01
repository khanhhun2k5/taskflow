"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

export type ViewMode = "kanban" | "list";

const storageKey = (projectId: string) => `taskflow:view:${projectId}`;

/** localStorage can be missing or throw (private mode, blocked storage): fall back quietly. */
export function readStoredView(projectId: string): ViewMode | null {
  try {
    const value = window.localStorage.getItem(storageKey(projectId));
    return value === "kanban" || value === "list" ? value : null;
  } catch {
    return null;
  }
}

export function storeView(projectId: string, view: ViewMode): void {
  try {
    window.localStorage.setItem(storageKey(projectId), view);
  } catch {
    // Not remembered; the URL still carries the choice.
  }
}

const noSubscribe = () => () => {};

/**
 * Kanban | List for a project (docs/06 section 3: ?view=). Order: the URL, then the choice
 * remembered for this project, then Kanban.
 */
export function useViewMode(projectId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const fromUrl = search.get("view");
  const stored = useSyncExternalStore(
    noSubscribe,
    () => readStoredView(projectId),
    () => null,
  );
  const view: ViewMode =
    fromUrl === "list" || fromUrl === "kanban" ? fromUrl : (stored ?? "kanban");

  const setView = useCallback(
    (next: ViewMode) => {
      storeView(projectId, next);
      const params = new URLSearchParams(search.toString());
      params.set("view", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [projectId, router, pathname, search],
  );
  return { view, setView };
}
