import { beforeAll, describe, expect, it } from "vitest";
import type { TaskDTO } from "@/features/tasks/schemas";
import type { Page } from "@/lib/pagination";
import { startOfDayInTz } from "@/lib/dates";
import { prisma } from "@/server/db";
import { api, type TestUser } from "./api";
import { createProject, createTask, newUser } from "./fixtures";

let user: TestUser;

beforeAll(async () => {
  user = await newUser("List User");
});

async function allPages(path: string, limit: number): Promise<TaskDTO[]> {
  const items: TaskDTO[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const query = `${separator}limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`;
    const page: { body: Page<TaskDTO> } = await api<Page<TaskDTO>>(user, "GET", `${path}${query}`);
    items.push(...page.body.items);
    cursor = page.body.nextCursor;
  } while (cursor);
  return items;
}

describe("GET /tasks", () => {
  it("cursor pagination walks every task exactly once, in a stable order", async () => {
    const fx = await createProject(user, "Paged");
    for (let i = 0; i < 7; i += 1) {
      await createTask(user, { title: `Paged ${i}`, projectId: fx.project.id });
    }
    const items = await allPages(`/tasks?projectId=${fx.project.id}`, 3);
    expect(items.map((task) => task.title)).toEqual(
      Array.from({ length: 7 }, (_, i) => `Paged ${i}`),
    );
  });

  it("limit defaults to 50 and is capped at 200", async () => {
    expect((await api(user, "GET", "/tasks?limit=201")).status).toBe(400);
    expect((await api(user, "GET", "/tasks?limit=200")).status).toBe(200);
  });

  it("q matches titles without accents or case (BR-82, index task_title_trgm)", async () => {
    await createTask(user, { title: "Viết Báo Cáo cuối kỳ" });
    await createTask(user, { title: "100% done_ok" });
    const found = await api<Page<TaskDTO>>(
      user,
      "GET",
      `/tasks?q=${encodeURIComponent("bao cao")}`,
    );
    expect(found.body.items.map((task) => task.title)).toEqual(["Viết Báo Cáo cuối kỳ"]);

    // LIKE wildcards in q are literal characters: "o_e" would match "one" in "done" if _ were a wildcard.
    const literal = await api<Page<TaskDTO>>(user, "GET", `/tasks?q=${encodeURIComponent("100%")}`);
    expect(literal.body.items.map((task) => task.title)).toEqual(["100% done_ok"]);
    const underscore = await api<Page<TaskDTO>>(user, "GET", "/tasks?q=o_e");
    expect(underscore.body.items).toEqual([]);
  });

  it("overdue=true returns exactly the tasks whose DTO says isOverdue (BR-04)", async () => {
    const now = new Date();
    const tz = "Asia/Ho_Chi_Minh"; // default User.timezone
    const today = startOfDayInTz(now, tz);
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    const cases = [
      { title: "all-day today", dueAt: today, dueAllDay: true },
      { title: "all-day yesterday", dueAt: yesterday, dueAllDay: true },
      { title: "timed past", dueAt: new Date(now.getTime() - 60_000), dueAllDay: false },
      { title: "timed future", dueAt: new Date(now.getTime() + 3600_000), dueAllDay: false },
    ];
    for (const item of cases) {
      await createTask(user, {
        title: `OD ${item.title}`,
        dueAt: item.dueAt.toISOString(),
        dueAllDay: item.dueAllDay,
      });
    }
    const late = await createTask(user, { title: "OD done", dueAt: yesterday.toISOString() });
    await api(user, "PATCH", `/tasks/${late.id}`, { statusCategory: "DONE" });

    const everything = (await allPages("/tasks", 200)).filter((task) =>
      task.title.startsWith("OD "),
    );
    const expected = everything
      .filter((task) => task.isOverdue)
      .map((task) => task.title)
      .sort();
    const filtered = (await allPages("/tasks?overdue=true", 200))
      .filter((task) => task.title.startsWith("OD "))
      .map((task) => task.title)
      .sort();
    expect(filtered).toEqual(expected);
    expect(filtered).toEqual(["OD all-day yesterday", "OD timed past"]);
  });

  it("inbox, status, priority, label and parent filters", async () => {
    const label = await api<{ id: string }>(user, "POST", "/labels", { name: "Filter" });
    const parent = await createTask(user, {
      title: "F parent",
      priority: "URGENT",
      labelIds: [label.body.id],
    });
    await createTask(user, { title: "F child", parentId: parent.id });

    const urgent = await api<Page<TaskDTO>>(user, "GET", "/tasks?priority=URGENT");
    expect(urgent.body.items.map((t) => t.title)).toContain("F parent");
    const labelled = await api<Page<TaskDTO>>(user, "GET", `/tasks?labelId=${label.body.id}`);
    expect(labelled.body.items.map((t) => t.title)).toEqual(["F parent"]);
    const children = await api<Page<TaskDTO>>(user, "GET", `/tasks?parentId=${parent.id}`);
    expect(children.body.items.map((t) => t.title)).toEqual(["F child"]);
    const inbox = await allPages("/tasks?inbox=true", 200);
    expect(inbox.some((t) => t.title === "F child")).toBe(false); // top-level only
    expect(inbox.some((t) => t.title === "F parent")).toBe(true);
  });

  it("sort=priority orders URGENT first and ties by id", async () => {
    const items = await allPages("/tasks?sort=priority", 200);
    const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
    const ranks = items.map((task) => rank[task.priority]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("deleted tasks never appear (BR-09)", async () => {
    const task = await createTask(user, { title: "Soon gone" });
    await api(user, "DELETE", `/tasks/${task.id}`);
    expect((await allPages("/tasks", 200)).some((t) => t.id === task.id)).toBe(false);
    expect(await prisma.task.count({ where: { id: task.id } })).toBe(1);
  });
});

describe("cursor pagination edge cases (review of MVP-1b)", () => {
  async function labelledTasks(name: string, dues: (string | null)[]) {
    const label = await api<{ id: string }>(user, "POST", "/labels", { name });
    const tasks: TaskDTO[] = [];
    for (const [i, dueAt] of dues.entries()) {
      tasks.push(
        await createTask(user, {
          title: `${name} ${i}`,
          labelIds: [label.body.id],
          ...(dueAt ? { dueAt } : {}),
        }),
      );
    }
    return { labelId: label.body.id, tasks };
  }

  it("a cursor task that no longer matches the filter does not hide the next item", async () => {
    const { labelId, tasks } = await labelledTasks("Cursor done", [null, null, null, null, null]);
    const path = `/tasks?labelId=${labelId}&status=TODO&limit=2`;
    const first = await api<Page<TaskDTO>>(user, "GET", path);
    expect(first.body.items.map((t) => t.id)).toEqual([tasks[0].id, tasks[1].id]);

    // The cursor task is completed between the two requests.
    await api(user, "PATCH", `/tasks/${tasks[1].id}`, { statusCategory: "DONE" });
    const second = await api<Page<TaskDTO>>(user, "GET", `${path}&cursor=${first.body.nextCursor}`);
    expect(second.body.items.map((t) => t.id)).toEqual([tasks[2].id, tasks[3].id]);
  });

  it("a cursor task deleted between pages does not hide the next item", async () => {
    const { labelId, tasks } = await labelledTasks("Cursor gone", [null, null, null, null]);
    const path = `/tasks?labelId=${labelId}&limit=2`;
    const first = await api<Page<TaskDTO>>(user, "GET", path);
    await api(user, "DELETE", `/tasks/${tasks[1].id}`);
    const second = await api<Page<TaskDTO>>(user, "GET", `${path}&cursor=${first.body.nextCursor}`);
    expect(second.body.items.map((t) => t.id)).toEqual([tasks[2].id, tasks[3].id]);
  });

  it.each(["dueAt", "-dueAt"])(
    "sort=%s pages through null due dates exactly once",
    async (sort) => {
      const { labelId } = await labelledTasks(`Nulls ${sort}`, [
        "2026-12-03T00:00:00.000Z",
        null,
        "2026-12-01T00:00:00.000Z",
        null,
        "2026-12-02T00:00:00.000Z",
        null,
      ]);
      const base = `/tasks?labelId=${labelId}&sort=${sort}`;
      const all = (await api<Page<TaskDTO>>(user, "GET", `${base}&limit=200`)).body.items;
      const paged = await allPages(base, 2);
      expect(paged.map((t) => t.id)).toEqual(all.map((t) => t.id));
      expect(new Set(paged.map((t) => t.id)).size).toBe(6);
    },
  );
});
