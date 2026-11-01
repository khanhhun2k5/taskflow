import { beforeAll, describe, expect, it } from "vitest";
import type { LabelDTO } from "@/features/labels/schemas";
import type { TaskDTO } from "@/features/tasks/schemas";
import type { Page } from "@/lib/pagination";
import { api, errorCode, type TestUser } from "./api";
import { createTask, newUser } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;

beforeAll(async () => {
  user = await newUser("Label User");
});

describe("labels (BR-81)", () => {
  it("a duplicate name in another case → 409 LABEL_EXISTS", async () => {
    expect((await api(user, "POST", "/labels", { name: "Urgent" })).status).toBe(201);
    const duplicate = await api(user, "POST", "/labels", { name: "urgent" });
    expect(duplicate.status).toBe(409);
    expect(errorCode(duplicate)).toBe("LABEL_EXISTS");

    expect((await api(user, "POST", "/labels", { name: "ĐỒ ÁN" })).status).toBe(201);
    expect(errorCode(await api(user, "POST", "/labels", { name: "đồ án" }))).toBe("LABEL_EXISTS");
  });

  it("renaming onto an existing name → 409", async () => {
    const label = await api<LabelDTO>(user, "POST", "/labels", { name: "Draft" });
    const response = await api(user, "PATCH", `/labels/${label.body.id}`, { name: "URGENT" });
    expect(errorCode(response)).toBe("LABEL_EXISTS");
    const renamed = await api<LabelDTO>(user, "PATCH", `/labels/${label.body.id}`, {
      color: "#FF0000",
    });
    expect(renamed.body).toMatchObject({ name: "Draft", color: "#FF0000" });
  });

  it("deleting a label removes it from every task", async () => {
    const label = await api<LabelDTO>(user, "POST", "/labels", { name: "Temporary" });
    const task = await createTask(user, { title: "Tagged", labelIds: [label.body.id] });
    expect(task.labels.map((l) => l.name)).toEqual(["Temporary"]);

    expect((await api(user, "DELETE", `/labels/${label.body.id}`)).status).toBe(204);
    const after = await api<TaskDTO>(user, "GET", `/tasks/${task.id}`);
    expect(after.body.labels).toEqual([]);
    await assertInvariants(user.id);
  });

  it("PATCH labelIds replaces the set", async () => {
    const a = await api<LabelDTO>(user, "POST", "/labels", { name: "Alpha" });
    const b = await api<LabelDTO>(user, "POST", "/labels", { name: "Beta" });
    const task = await createTask(user, { title: "Retag", labelIds: [a.body.id] });
    const updated = await api<TaskDTO>(user, "PATCH", `/tasks/${task.id}`, {
      labelIds: [b.body.id],
    });
    expect(updated.body.labels.map((l) => l.name)).toEqual(["Beta"]);
  });

  it("lists labels sorted by name with cursor pagination", async () => {
    const first = await api<Page<LabelDTO>>(user, "GET", "/labels?limit=2");
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await api<Page<LabelDTO>>(
      user,
      "GET",
      `/labels?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items[0]?.id).not.toBe(first.body.items[1]?.id);
  });
});
