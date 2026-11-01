import { z } from "zod";

export const NAME_MAX_LENGTH = 100;

const timeZones = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);

export const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);

export const timezoneSchema = z
  .string()
  .refine((value) => timeZones.has(value), { message: "Unknown IANA time zone" });

export const localeSchema = z.enum(["vi", "en"]);

// date-fns convention: 0 = Sunday, 1 = Monday (docs/04, docs/05 section 2.1).
export const weekStartsOnSchema = z.union([z.literal(0), z.literal(1)]);

// PATCH /api/v1/me. Strict: unknown keys such as id/email/userId are rejected (NFR-10).
export const updateMeSchema = z
  .strictObject({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    locale: localeSchema.optional(),
    weekStartsOn: weekStartsOnSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required" });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export type MeDTO = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  locale: z.infer<typeof localeSchema>;
  weekStartsOn: z.infer<typeof weekStartsOnSchema>;
  createdAt: string;
};
