import { describe, expect, it } from "vitest";
import { updateMeSchema } from "./schemas";

describe("updateMeSchema", () => {
  it("accepts valid settings", () => {
    const result = updateMeSchema.safeParse({
      name: "  An  ",
      timezone: "America/New_York",
      locale: "en",
      weekStartsOn: 0,
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("An");
  });

  it.each([
    [{ timezone: "Mars/Olympus" }],
    [{ locale: "fr" }],
    [{ weekStartsOn: 6 }],
    [{ name: "   " }],
    [{ name: "x".repeat(101) }],
    [{ email: "other@example.test" }],
    [{}],
  ])("rejects %j", (input) => {
    expect(updateMeSchema.safeParse(input).success).toBe(false);
  });
});
