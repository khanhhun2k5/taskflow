// docs/06 section 7: project (and later course) colors come from a fixed palette of 12.
// Each color is a graphic element (dot, bar), so it needs ≥ 3:1 contrast against both the
// light and the dark surfaces (NFR-22); palette.test.ts checks this.

export const PROJECT_COLORS = [
  { key: "indigo", hex: "#6366F1" }, // default (Project.color in schema.prisma)
  { key: "blue", hex: "#3B82F6" },
  { key: "cyan", hex: "#0891B2" },
  { key: "teal", hex: "#0D9488" },
  { key: "green", hex: "#16A34A" },
  { key: "amber", hex: "#D97706" },
  { key: "orange", hex: "#EA580C" },
  { key: "red", hex: "#EF4444" },
  { key: "pink", hex: "#DB2777" },
  { key: "fuchsia", hex: "#C026D3" },
  { key: "violet", hex: "#8B5CF6" },
  { key: "slate", hex: "#64748B" },
] as const;

export type ProjectColorKey = (typeof PROJECT_COLORS)[number]["key"];

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].hex;

/** WCAG 2.x relative luminance of "#RRGGBB". */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new RangeError(`Invalid hex color: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#RRGGBB" colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
