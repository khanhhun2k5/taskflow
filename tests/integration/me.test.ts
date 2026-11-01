import { describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/v1/me/route";
import { prisma } from "@/server/db";
import { jsonRequest, signUpUser } from "./helpers";

type ErrorJson = { error: { code: string; details?: { path: string }[] } };

describe("GET /api/v1/me", () => {
  it("returns 401 UNAUTHENTICATED without a session", async () => {
    const response = await GET(jsonRequest("/api/v1/me", {}));
    expect(response.status).toBe(401);
    expect(((await response.json()) as ErrorJson).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the signed-in user's profile with default settings", async () => {
    const user = await signUpUser("Alice");
    const response = await GET(jsonRequest("/api/v1/me", { cookie: user.cookie }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: user.id,
      email: user.email,
      name: "Alice",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
      weekStartsOn: 1,
    });
  });
});

describe("PATCH /api/v1/me", () => {
  it("rejects an invalid timezone with 400 VALIDATION_ERROR", async () => {
    const user = await signUpUser();
    const response = await PATCH(
      jsonRequest("/api/v1/me", {
        method: "PATCH",
        cookie: user.cookie,
        body: { timezone: "Mars/Olympus" },
      }),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as ErrorJson;
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details?.map((d) => d.path)).toContain("timezone");
  });

  it("does not leak stack traces for malformed JSON", async () => {
    const user = await signUpUser();
    const request = new Request("http://localhost:3000/api/v1/me", {
      method: "PATCH",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: "{not json",
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(/at .*\(|stack/i);
  });

  it("returns 401 without a session", async () => {
    const response = await PATCH(
      jsonRequest("/api/v1/me", { method: "PATCH", body: { name: "Mallory" } }),
    );
    expect(response.status).toBe(401);
  });
});

describe("US-03: users only read and update their own profile", () => {
  it("updates only the caller and leaves other users unchanged", async () => {
    const alice = await signUpUser("Alice");
    const bob = await signUpUser("Bob");

    const response = await PATCH(
      jsonRequest("/api/v1/me", {
        method: "PATCH",
        cookie: alice.cookie,
        body: { name: "Alice Nguyen", timezone: "America/New_York", locale: "en", weekStartsOn: 0 },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: alice.id, name: "Alice Nguyen" });

    const bobRow = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
    expect(bobRow).toMatchObject({ name: "Bob", timezone: "Asia/Ho_Chi_Minh", locale: "vi" });

    const bobView = await GET(jsonRequest("/api/v1/me", { cookie: bob.cookie }));
    expect(await bobView.json()).toMatchObject({ id: bob.id, name: "Bob" });
  });

  it("rejects attempts to target another user via the body (NFR-10)", async () => {
    const alice = await signUpUser("Alice");
    const bob = await signUpUser("Bob");

    const response = await PATCH(
      jsonRequest("/api/v1/me", {
        method: "PATCH",
        cookie: alice.cookie,
        body: { id: bob.id, name: "Hacked" },
      }),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as ErrorJson).error.code).toBe("VALIDATION_ERROR");

    const bobRow = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
    expect(bobRow.name).toBe("Bob");
  });
});
