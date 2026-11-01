// Shared helpers for prisma/seed.ts and prisma/seed-large.ts (development data only,
// docs/04 section 5). Data goes through the service layer so every rule and hand-written
// constraint holds (BR-01, BR-20, BR-27, ordering keys…).
import { existsSync } from "node:fs";

export const DEMO_EMAIL = "demo@taskflow.local";
export const DEMO_PASSWORD = "demo-taskflow-123"; // development only, never a real account
export const DEMO_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Loads .env (like prisma.config.ts) and refuses to run in production. */
export function prepare(): void {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (process.env.NODE_ENV === "production") {
    console.error("Seed data is for development only; NODE_ENV=production, nothing was written.");
    process.exit(1);
  }
}

/** Server modules read the environment when imported, so load them after prepare(). */
export async function loadServer() {
  const [{ auth }, { prisma }, tasks, projects, labels, boards] = await Promise.all([
    import("@/server/auth"),
    import("@/server/db"),
    import("@/server/services/tasks"),
    import("@/server/services/projects"),
    import("@/server/services/labels"),
    import("@/server/services/boards"),
  ]);
  return { auth, prisma, tasks, projects, labels, boards };
}

export type Server = Awaited<ReturnType<typeof loadServer>>;

/** Returns the demo user's id, creating the account if needed. */
export async function ensureDemoUser({ auth, prisma }: Server): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing.id;
  const { user } = await auth.api.signUpEmail({
    body: { name: "Người dùng demo", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { timezone: DEMO_TIMEZONE, locale: "vi" },
  });
  return user.id;
}

/** Deletes the demo user's business data (never other users'), keeping the account. */
export async function resetDemoData({ prisma }: Server, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.task.deleteMany({ where: { userId } }),
    prisma.label.deleteMany({ where: { userId } }),
    prisma.project.deleteMany({ where: { userId } }),
  ]);
}
