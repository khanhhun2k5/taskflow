// Creates .env from .env.example for local development and fills BETTER_AUTH_SECRET
// with a random value. Never overwrites an existing .env. Usage: npm run env:init
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const target = ".env";

if (existsSync(target)) {
  console.log(".env already exists; nothing changed.");
  process.exit(0);
}

copyFileSync(".env.example", target);
const secret = randomBytes(32).toString("base64url");
const content = readFileSync(target, "utf8").replace(
  /^BETTER_AUTH_SECRET=.*$/m,
  `BETTER_AUTH_SECRET=${secret}`,
);
writeFileSync(target, content);
console.log("Created .env with a random BETTER_AUTH_SECRET.");
