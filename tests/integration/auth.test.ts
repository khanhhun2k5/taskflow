import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";
import { prisma } from "@/server/db";
import { jsonRequest } from "./helpers";

describe("POST /api/auth/sign-up/email", () => {
  it("US-01: rejects a 7-character password and creates no user", async () => {
    const email = `short-${Date.now()}@example.test`;
    const response = await POST(
      jsonRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { name: "Short", email, password: "1234567" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("accepts an 8-character password", async () => {
    const email = `ok-${Date.now()}@example.test`;
    const response = await POST(
      jsonRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { name: "Ok", email, password: "12345678" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });
});
