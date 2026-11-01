// docs/04 section 4: invariants the service layer must keep. Call after every write in tests.
import { expect } from "vitest";
import { prisma } from "@/server/db";

type Row = { id: string };

/** Each query returns the ids that break one invariant; all must be empty. */
export async function invariantViolations(userId: string) {
  const [
    statusMatchesColumn,
    columnOnOwnBoard,
    sprintRule,
    doneHasCompletedAt,
    ownership,
    depth,
    onBoard,
  ] = await Promise.all([
    // 1. task.columnId != null ⇒ task.statusCategory == column.statusCategory (BR-01, ADR-03)
    prisma.$queryRaw<Row[]>`
        SELECT t."id" FROM "Task" t JOIN "Column" c ON c."id" = t."columnId"
        WHERE t."userId" = ${userId} AND t."statusCategory" <> c."statusCategory"`,
    // 2. task.columnId != null ⇒ the column is on the board of task.projectId, or of
    //    task.courseId when there is no project (BR-24)
    prisma.$queryRaw<Row[]>`
        SELECT t."id" FROM "Task" t
        JOIN "Column" c ON c."id" = t."columnId" JOIN "Board" b ON b."id" = c."boardId"
        WHERE t."userId" = ${userId} AND NOT (
          (t."projectId" IS NOT NULL AND b."projectId" = t."projectId") OR
          (t."projectId" IS NULL AND t."courseId" IS NOT NULL AND b."courseId" = t."courseId"))`,
    // 3. task.sprintId != null ⇒ same project and no parent (BR-42). No Sprint model before
    //    MVP-3, so sprintId must stay null.
    prisma.$queryRaw<Row[]>`
        SELECT "id" FROM "Task" WHERE "userId" = ${userId} AND "sprintId" IS NOT NULL`,
    // 4. statusCategory == DONE ⇔ completedAt != null (BR-03)
    prisma.$queryRaw<Row[]>`
        SELECT "id" FROM "Task" WHERE "userId" = ${userId}
          AND ("statusCategory" = 'DONE') <> ("completedAt" IS NOT NULL)`,
    // 5. every related row belongs to the same user (US-03)
    prisma.$queryRaw<Row[]>`
        SELECT t."id" FROM "Task" t LEFT JOIN "Project" p ON p."id" = t."projectId"
          LEFT JOIN "Column" c ON c."id" = t."columnId" LEFT JOIN "Task" parent ON parent."id" = t."parentId"
        WHERE t."userId" = ${userId} AND (p."userId" <> t."userId" OR c."userId" <> t."userId"
          OR parent."userId" <> t."userId")
        UNION ALL
        SELECT c."id" FROM "Column" c JOIN "Board" b ON b."id" = c."boardId"
          LEFT JOIN "Project" p ON p."id" = b."projectId"
        WHERE (c."userId" = ${userId} OR b."userId" = ${userId})
          AND (c."userId" <> b."userId" OR p."userId" <> b."userId")
        UNION ALL
        SELECT tl."taskId" FROM "TaskLabel" tl JOIN "Task" t ON t."id" = tl."taskId"
          JOIN "Label" l ON l."id" = tl."labelId"
        WHERE (t."userId" = ${userId} OR l."userId" = ${userId}) AND t."userId" <> l."userId"
        UNION ALL
        SELECT a."id" FROM "ActivityLog" a JOIN "Task" t ON t."id" = a."taskId"
        WHERE (a."userId" = ${userId} OR t."userId" = ${userId}) AND a."userId" <> t."userId"`,
    // Extra: BR-05 (two levels), BR-06 (subtask in parent's project), BR-07 (no column)
    prisma.$queryRaw<Row[]>`
        SELECT child."id" FROM "Task" child JOIN "Task" parent ON parent."id" = child."parentId"
        WHERE child."userId" = ${userId} AND (parent."parentId" IS NOT NULL
          OR child."projectId" IS DISTINCT FROM parent."projectId" OR child."columnId" IS NOT NULL)`,
    // Extra: a live top-level task of a project always sits in a column (BR-27, BR-26)
    prisma.$queryRaw<Row[]>`
        SELECT "id" FROM "Task" WHERE "userId" = ${userId} AND "projectId" IS NOT NULL
          AND "parentId" IS NULL AND "deletedAt" IS NULL AND "columnId" IS NULL`,
  ]);

  const ids = (rows: Row[]) => rows.map((row) => row.id);
  return {
    statusMatchesColumn: ids(statusMatchesColumn),
    columnOnOwnBoard: ids(columnOnOwnBoard),
    sprintRule: ids(sprintRule),
    doneHasCompletedAt: ids(doneHasCompletedAt),
    ownership: ids(ownership),
    subtaskRules: ids(depth),
    projectTaskOnBoard: ids(onBoard),
  };
}

export async function assertInvariants(userId: string): Promise<void> {
  expect(await invariantViolations(userId)).toEqual({
    statusMatchesColumn: [],
    columnOnOwnBoard: [],
    sprintRule: [],
    doneHasCompletedAt: [],
    ownership: [],
    subtaskRules: [],
    projectTaskOnBoard: [],
  });
}
