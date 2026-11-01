import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

function createPrismaClient(): PrismaClient {
  const connectionString = getEnv().DATABASE_URL;
  // Honor Prisma's `?schema=` convention (used by integration tests: one schema per file).
  // The adapter option only qualifies model queries, so raw SQL ($queryRaw) also needs the
  // search_path; "public" stays second because the extensions live there.
  const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;
  const options = schema ? `-c search_path="${schema.replaceAll('"', '""')}",public` : undefined;
  const adapter = new PrismaPg({ connectionString, options }, { schema });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
