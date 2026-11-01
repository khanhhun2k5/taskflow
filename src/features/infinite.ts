import type { InfiniteData } from "@tanstack/react-query";
import type { Page } from "@/lib/pagination";

// Cursor pages (docs/05 section 1) as TanStack infinite data. Shared by task lists and trash.

export type Pages<T> = InfiniteData<Page<T>, unknown>;

/** Infinite data holding one already-loaded page (server prefetch, ADR-06). */
export function firstPage<T>(page: Page<T>): Pages<T> {
  return { pages: [page], pageParams: [null] };
}

export function allItems<T>(data: Pages<T> | undefined): T[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

/** Applies `map` to every page's items; undefined stays undefined (query not loaded). */
export function mapPages<T>(data: Pages<T> | undefined, map: (items: T[]) => T[]) {
  return data
    ? { ...data, pages: data.pages.map((page) => ({ ...page, items: map(page.items) })) }
    : data;
}

/** Appends to the last page (where a new row shows up in an "order" list). */
export function appendToLastPage<T>(data: Pages<T> | undefined, item: T) {
  if (!data || data.pages.length === 0) return data;
  const pages = [...data.pages];
  const last = pages[pages.length - 1];
  pages[pages.length - 1] = { ...last, items: [...last.items, item] };
  return { ...data, pages };
}

export const nextCursor = <T>(page: Page<T>) => page.nextCursor ?? undefined;
