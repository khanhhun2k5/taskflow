import { z } from "zod";

// Empty strings (e.g. `GOOGLE_CLIENT_ID=` copied from .env.example) count as "not set".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

// docs/03-architecture.md section 5
const envSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // Required from P4; optional until then.
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  CRON_SECRET: optionalString,
});

export type Env = z.infer<typeof envSchema>;

type EnvSource = Record<string, string | undefined>;
type Warn = (message: string) => void;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment variables:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "EnvError";
  }
}

/** Google sign-in is enabled only when both client id and secret are set (US-02). */
export function isGoogleEnabled(env: Env): boolean {
  return env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined;
}

export function parseEnv(source: EnvSource, warn: Warn = console.warn): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const env = result.data;
  const hasId = env.GOOGLE_CLIENT_ID !== undefined;
  const hasSecret = env.GOOGLE_CLIENT_SECRET !== undefined;
  if (hasId !== hasSecret) {
    warn("Only one of GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is set; Google sign-in is disabled.");
  }
  return env;
}

let cached: Env | undefined;

/** Validated server env, parsed on first use so builds without a .env do not fail early. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
