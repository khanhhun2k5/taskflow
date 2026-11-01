import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { withTxRetry } from "@/server/tx-retry";

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

/**
 * `prisma.$transaction` with automatic retry on Prisma P2034 (write conflict / deadlock):
 * 3 attempts in total, then 409 CONFLICT (src/server/tx-retry.ts). Use this instead of
 * calling `prisma.$transaction` directly.
 */
export function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: Parameters<PrismaClient["$transaction"]>[1],
): Promise<T> {
  return withTxRetry(() => prisma.$transaction(fn, options));
}
