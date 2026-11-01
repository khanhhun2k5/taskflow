import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 7 does not load .env by itself; use Node's built-in loader instead of dotenv.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Development data only (docs/04 section 5); the script refuses NODE_ENV=production.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
