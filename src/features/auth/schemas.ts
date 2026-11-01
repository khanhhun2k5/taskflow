import { z } from "zod";
import { nameSchema } from "@/features/users/schemas";

// Keep in sync with emailAndPassword.minPasswordLength in src/server/auth.ts (US-01).
export const PASSWORD_MIN_LENGTH = 8;

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const signUpSchema = z.object({
  name: nameSchema,
  email: z.email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
