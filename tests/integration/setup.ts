// Runs before each integration test file (docs/09 section 2): creates a fresh
// PostgreSQL schema, applies migrations to it, and drops it afterwards.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { Client } from "pg";
import { afterAll } from "vitest";

if (existsSync(".env")) process.loadEnvFile(".env");

const baseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://taskflow:taskflow@localhost:5432/taskflow",
);
baseUrl.searchParams.delete("schema");

const schema = `test_${randomBytes(6).toString("hex")}`;
const schemaUrl = new URL(baseUrl);
schemaUrl.searchParams.set("schema", schema);

const admin = new Client({ connectionString: baseUrl.toString() });
await admin.connect();
await admin.query(`CREATE SCHEMA "${schema}"`);

execSync("npx prisma migrate deploy", {
  env: { ...process.env, DATABASE_URL: schemaUrl.toString() },
  stdio: "pipe",
});

process.env.DATABASE_URL = schemaUrl.toString();
process.env.BETTER_AUTH_SECRET ||= "integration-test-secret-integration-test-secret";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";

afterAll(async () => {
  const { prisma } = await import("@/server/db");
  await prisma.$disconnect();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
});
