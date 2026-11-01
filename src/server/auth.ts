import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";
import { getEnv, isGoogleEnabled } from "@/lib/env";
import { prisma } from "@/server/db";

const env = getEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH, // US-01
    autoSignIn: true, // US-01: land on /today right after sign-up
  },
  // US-02: Google only when both credentials are configured.
  socialProviders: isGoogleEnabled(env)
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
        },
      }
    : {},
  user: {
    additionalFields: {
      // Profile settings change only through PATCH /api/v1/me, never at sign-up.
      timezone: { type: "string", required: false, input: false, defaultValue: "Asia/Ho_Chi_Minh" },
      locale: { type: "string", required: false, input: false, defaultValue: "vi" },
      weekStartsOn: { type: "number", required: false, input: false, defaultValue: 1 },
    },
  },
  // NFR-11 (a): enabled explicitly in every environment (Better Auth defaults to production only).
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  advanced: {
    ipAddress: {
      // Vercel and most reverse proxies overwrite x-forwarded-for with the client IP.
      // See docs/08-non-functional.md NFR-11.
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
  // Must stay last so Set-Cookie works from Server Components and Route Handlers.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
