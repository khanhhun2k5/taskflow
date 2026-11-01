import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_PROJECT_COLOR, PROJECT_COLORS, relativeLuminance } from "./palette";

// Surfaces from src/app/globals.css: light --background/--card = oklch(1 0 0);
// dark --background = oklch(0.145 0 0) ≈ #0A0A0A, dark --card = oklch(0.205 0 0) ≈ #171717.
const SURFACES = { light: "#FFFFFF", darkBackground: "#0A0A0A", darkCard: "#171717" };

describe("project palette (docs/06 section 7, NFR-22)", () => {
  it("has 12 distinct colors and includes the schema default", () => {
    expect(PROJECT_COLORS).toHaveLength(12);
    expect(new Set(PROJECT_COLORS.map((color) => color.hex)).size).toBe(12);
    expect(DEFAULT_PROJECT_COLOR).toBe("#6366F1");
  });

  it.each(PROJECT_COLORS)("$key has ≥ 3:1 contrast on light and dark surfaces", ({ hex }) => {
    for (const surface of Object.values(SURFACES)) {
      expect(contrastRatio(hex, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("contrast helpers", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 10);
  });

  it("rejects malformed colors", () => {
    expect(() => relativeLuminance("red")).toThrow(RangeError);
  });
});
