// Guard for hand-written SQL (docs/04 section 3). Prisma cannot express these objects, so a
// later migration could drop them by accident. This test runs on a schema built from all
// migrations (tests/integration/setup.ts) and fails CI if any of them is missing.
// Keep this list in sync with docs/04 section 3.
import { describe, expect, it } from "vitest";
import type { StatusCategory as PrismaStatusCategory } from "@/generated/prisma/client";
import type { StatusCategory } from "@/lib/dates";
import { prisma } from "@/server/db";

export const MANUAL_CONSTRAINTS = [
  { table: "Board", name: "board_owner_xor" },
  { table: "Task", name: "task_estimate_nonneg" },
] as const;

export const MANUAL_INDEXES = [
  { table: "Label", name: "label_user_name_ci", contains: "lower((name)::text)" },
  { table: "Task", name: "task_title_trgm", contains: "gin_trgm_ops" },
] as const;

export const C_COLLATED_COLUMNS = [
  { table: "Task", column: "order" },
  { table: "Task", column: "backlogOrder" },
  { table: "Column", column: "order" },
] as const;

export const EXTENSIONS = ["unaccent", "pg_trgm"] as const;

// Compile-time check: the domain type mirrors the Prisma enum exactly (src/lib/dates.ts).
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const statusCategoryMatchesPrisma: Equal<PrismaStatusCategory, StatusCategory> = true;

async function currentSchema(): Promise<string> {
  const rows = await prisma.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
  return rows[0].schema;
}

describe("hand-written DB objects survive all migrations", () => {
  it("runs on the per-file test schema, not on public (tests/integration/setup.ts)", async () => {
    expect(await currentSchema()).toMatch(/^test_[0-9a-f]+$/);
  });

  it("StatusCategory domain type matches the Prisma enum", () => {
    expect(statusCategoryMatchesPrisma).toBe(true);
  });

  it.each(MANUAL_CONSTRAINTS)("CHECK $name exists on $table", async ({ table, name }) => {
    const schema = await currentSchema();
    const rows = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT c.conname FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = 'c' AND c.conname = ${name} AND t.relname = ${table} AND n.nspname = ${schema}`;
    expect(rows).toHaveLength(1);
  });

  it.each(MANUAL_INDEXES)("index $name exists on $table", async ({ table, name, contains }) => {
    const schema = await currentSchema();
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = ${schema} AND tablename = ${table} AND indexname = ${name}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain(contains);
  });

  it("label_user_name_ci is UNIQUE", async () => {
    const schema = await currentSchema();
    const rows = await prisma.$queryRaw<{ indisunique: boolean }[]>`
      SELECT i.indisunique FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'label_user_name_ci' AND n.nspname = ${schema}`;
    expect(rows).toEqual([{ indisunique: true }]);
  });

  it("function f_unaccent exists and is IMMUTABLE", async () => {
    const schema = await currentSchema();
    const rows = await prisma.$queryRaw<{ provolatile: string }[]>`
      SELECT p.provolatile::text AS provolatile FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'f_unaccent' AND n.nspname = ${schema}`;
    expect(rows).toEqual([{ provolatile: "i" }]);
  });

  it.each(C_COLLATED_COLUMNS)('$table.$column uses COLLATE "C"', async ({ table, column }) => {
    const schema = await currentSchema();
    const rows = await prisma.$queryRaw<{ collation_name: string | null }[]>`
      SELECT collation_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = ${table} AND column_name = ${column}`;
    expect(rows).toEqual([{ collation_name: "C" }]);
  });

  it.each(EXTENSIONS)("extension %s is installed", async (name) => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = ${name}`;
    expect(rows).toHaveLength(1);
  });
});
