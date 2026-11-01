import { localeSchema } from "@/features/users/schemas";

export type Locale = (typeof locales)[number];

export const locales = localeSchema.options;
export const defaultLocale: Locale = "vi";
export const defaultTimeZone = "Asia/Ho_Chi_Minh";

/** NFR-41: the UI language follows `User.locale`; anything unknown falls back to Vietnamese. */
export function resolveLocale(value: unknown): Locale {
  const result = localeSchema.safeParse(value);
  return result.success ? result.data : defaultLocale;
}
