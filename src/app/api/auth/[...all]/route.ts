import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { errorResponse } from "@/server/errors";

const handlers = toNextJsHandler(auth);

// NFR-11: re-shape Better Auth's 429 into the standard error format (docs/05 section 1.1).
async function withRateLimitFormat(response: Response): Promise<Response> {
  if (response.status !== 429) return response;
  const headers = new Headers();
  for (const name of ["retry-after", "x-retry-after"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return errorResponse("RATE_LIMITED", "Too many requests", undefined, { headers });
}

export async function GET(req: Request): Promise<Response> {
  return withRateLimitFormat(await handlers.GET(req));
}

export async function POST(req: Request): Promise<Response> {
  return withRateLimitFormat(await handlers.POST(req));
}
