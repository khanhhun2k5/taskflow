import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";
import { resolveLocale } from "./locales";

function flatten(value: unknown, prefix = ""): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        entries.set(path, leaf);
      }
    }
  } else {
    entries.set(prefix, value);
  }
  return entries;
}

describe("messages (NFR-40)", () => {
  const viKeys = flatten(vi);
  const enKeys = flatten(en);

  it("vi.json and en.json have the same keys", () => {
    const missingInEn = [...viKeys.keys()].filter((key) => !enKeys.has(key));
    const missingInVi = [...enKeys.keys()].filter((key) => !viKeys.has(key));
    expect({ missingInEn, missingInVi }).toEqual({ missingInEn: [], missingInVi: [] });
  });

  it.each([
    ["vi", viKeys],
    ["en", enKeys],
  ])("%s.json has only non-empty strings", (_locale, keys) => {
    const invalid = [...keys].filter(([, leaf]) => typeof leaf !== "string" || leaf.trim() === "");
    expect(invalid).toEqual([]);
  });
});

describe("resolveLocale (NFR-41)", () => {
  it("keeps supported locales", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("vi")).toBe("vi");
  });

  it("falls back to vi for unknown or missing values", () => {
    expect(resolveLocale("fr")).toBe("vi");
    expect(resolveLocale(undefined)).toBe("vi");
    expect(resolveLocale(null)).toBe("vi");
  });
});
