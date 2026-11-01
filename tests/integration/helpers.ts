import { auth } from "@/server/auth";

export const BASE_URL = "http://localhost:3000";

let counter = 0;

/** Signs up a fresh user through Better Auth and returns a Cookie header for it. */
export async function signUpUser(name = "Test User") {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.test`;
  const response = await auth.api.signUpEmail({
    body: { name, email, password: "correct-horse-battery" },
    asResponse: true,
  });
  if (!response.ok) throw new Error(`Sign-up failed with status ${response.status}`);

  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const body = (await response.json()) as { user: { id: string } };
  return { id: body.user.id, email, cookie };
}

export function jsonRequest(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown },
) {
  const headers = new Headers({ "content-type": "application/json", origin: BASE_URL });
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
