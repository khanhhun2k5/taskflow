import { z } from "zod";

// Cursor pagination, docs/05 section 1: ?cursor=<id>&limit=50 (default 50, max 200).
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const pageQueryShape = {
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export type Page<T> = { items: T[]; nextCursor: string | null };

/** `rows` must be fetched with `take: limit + 1`; the extra row only signals a next page. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}

/** Query string → plain object for Zod (repeated keys keep the last value). */
export function queryObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams);
}

/** "true" / "false" query flags. */
export const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
