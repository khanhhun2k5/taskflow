// MVP-1 data layer: hand-written constraints reject bad data, and DB ordering matches JS.
import { randomInt, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { keyBetween, keysForAppend } from "@/lib/ordering";
import { prisma } from "@/server/db";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { id: randomUUID(), name: "Constraint User", email: `${randomUUID()}@example.test` },
  });
  userId = user.id;
});

async function createProject() {
  return prisma.project.create({ data: { userId, name: "Project" } });
}

describe("TC-25 DB order matches JS order (ADR-05)", () => {
  it("200 random keys read back with orderBy match a JS `<` sort", async () => {
    // Build keys the way the app does: random inserts between neighbours.
    const keys = keysForAppend(2);
    while (keys.length < 200) {
      const index = randomInt(keys.length + 1);
      const before = index === 0 ? null : keys[index - 1];
      const after = index === keys.length ? null : keys[index];
      keys.splice(index, 0, keyBetween(before, after));
    }
    const shuffled = [...keys].sort(() => Math.random() - 0.5);

    const project = await createProject();
    await prisma.task.createMany({
      data: shuffled.map((order, i) => ({ userId, projectId: project.id, title: `T${i}`, order })),
    });

    const fromDb = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      select: { order: true },
    });
    const jsSorted = [...shuffled].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    expect(fromDb.map((task) => task.order)).toEqual(jsSorted);
    expect(jsSorted).toEqual(keys);
  });

  it("mixed-case keys sort byte-wise, not by locale", async () => {
    const project = await createProject();
    const orders = ["a0", "Zz", "a0V", "A0", "b"];
    await prisma.task.createMany({
      data: orders.map((order, i) => ({ userId, projectId: project.id, title: `M${i}`, order })),
    });
    const fromDb = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      select: { order: true },
    });
    expect(fromDb.map((task) => task.order)).toEqual(["A0", "Zz", "a0", "a0V", "b"]);
  });
});

describe("hand-written constraints reject invalid data (docs/04 section 3)", () => {
  it("board_owner_xor: a board with neither a project nor a course is rejected", async () => {
    await expect(prisma.board.create({ data: { userId } })).rejects.toThrow(/board_owner_xor/);
  });

  it("board_owner_xor: a board with both a project and a course is rejected", async () => {
    const project = await createProject();
    await expect(
      prisma.board.create({ data: { userId, projectId: project.id, courseId: "course-1" } }),
    ).rejects.toThrow(/board_owner_xor/);
  });

  it("board_owner_xor: exactly one owner is accepted", async () => {
    const project = await createProject();
    await expect(
      prisma.board.create({ data: { userId, projectId: project.id } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.board.create({ data: { userId, courseId: randomUUID() } }),
    ).resolves.toBeTruthy();
  });

  it("label_user_name_ci: same name in another case is rejected (BR-81)", async () => {
    await prisma.label.create({ data: { userId, name: "Urgent" } });
    await expect(prisma.label.create({ data: { userId, name: "urgent" } })).rejects.toThrow(
      /label_user_name_ci|Unique constraint/,
    );

    await prisma.label.create({ data: { userId, name: "ĐỒ ÁN" } });
    await expect(prisma.label.create({ data: { userId, name: "đồ án" } })).rejects.toThrow(
      /label_user_name_ci|Unique constraint/,
    );
  });

  it("label_user_name_ci: another user may reuse the name", async () => {
    const other = await prisma.user.create({
      data: { id: randomUUID(), name: "Other", email: `${randomUUID()}@example.test` },
    });
    await prisma.label.create({ data: { userId, name: "Shared" } });
    await expect(
      prisma.label.create({ data: { userId: other.id, name: "shared" } }),
    ).resolves.toBeTruthy();
  });

  it("task_estimate_nonneg: a negative estimate is rejected (BR-41)", async () => {
    await expect(
      prisma.task.create({ data: { userId, title: "Negative", order: "a0", estimate: -1 } }),
    ).rejects.toThrow(/task_estimate_nonneg/);
  });

  it("task_estimate_nonneg: zero and null are accepted", async () => {
    await expect(
      prisma.task.create({ data: { userId, title: "Zero", order: "a0", estimate: 0 } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.task.create({ data: { userId, title: "None", order: "a1" } }),
    ).resolves.toBeTruthy();
  });
});

describe("task_title_trgm search (BR-82)", () => {
  it("finds titles ignoring accents and case through f_unaccent", async () => {
    const project = await createProject();
    await prisma.task.createMany({
      data: [
        { userId, projectId: project.id, title: "Viết Báo Cáo cuối kỳ", order: "a0" },
        { userId, projectId: project.id, title: "Ôn tập giữa kỳ", order: "a1" },
      ],
    });
    const rows = await prisma.$queryRaw<{ title: string }[]>`
      SELECT "title" FROM "Task"
      WHERE "projectId" = ${project.id}
        AND f_unaccent(lower("title")) LIKE '%' || f_unaccent(lower(${"bao cao"})) || '%'`;
    expect(rows.map((row) => row.title)).toEqual(["Viết Báo Cáo cuối kỳ"]);
  });
});
