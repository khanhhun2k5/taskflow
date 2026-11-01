import { describe, expect, it, vi } from "vitest";
import { EnvError, isGoogleEnabled, parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://taskflow:taskflow@localhost:5432/taskflow",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("throws listing every missing required variable", () => {
    expect(() => parseEnv({}, vi.fn())).toThrow(EnvError);
    try {
      parseEnv({}, vi.fn());
    } catch (error) {
      const message = (error as EnvError).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("BETTER_AUTH_SECRET");
      expect(message).toContain("BETTER_AUTH_URL");
    }
  });

  it("treats empty optional values as unset and keeps Google disabled", () => {
    const warn = vi.fn();
    const env = parseEnv({ ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }, warn);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(isGoogleEnabled(env)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and disables Google when only one credential is set", () => {
    const warn = vi.fn();
    const env = parseEnv({ ...base, GOOGLE_CLIENT_ID: "id" }, warn);
    expect(isGoogleEnabled(env)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("enables Google when both credentials are set", () => {
    const env = parseEnv(
      { ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" },
      vi.fn(),
    );
    expect(isGoogleEnabled(env)).toBe(true);
  });
});
