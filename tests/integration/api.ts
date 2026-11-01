// Calls the real Route Handlers with a real session cookie (docs/09: integration tests go
// through the HTTP layer). Usage: api(user, "POST", `/tasks/${id}/move`, body).
import * as boardColumns from "@/app/api/v1/boards/[id]/columns/route";
import * as board from "@/app/api/v1/boards/[id]/route";
import * as columnMove from "@/app/api/v1/columns/[id]/move/route";
import * as column from "@/app/api/v1/columns/[id]/route";
import * as label from "@/app/api/v1/labels/[id]/route";
import * as labels from "@/app/api/v1/labels/route";
import * as projectProgress from "@/app/api/v1/projects/[id]/progress/route";
import * as projectRestore from "@/app/api/v1/projects/[id]/restore/route";
import * as project from "@/app/api/v1/projects/[id]/route";
import * as projects from "@/app/api/v1/projects/route";
import * as taskMove from "@/app/api/v1/tasks/[id]/move/route";
import * as taskRestore from "@/app/api/v1/tasks/[id]/restore/route";
import * as task from "@/app/api/v1/tasks/[id]/route";
import * as tasksBulk from "@/app/api/v1/tasks/bulk/route";
import * as tasks from "@/app/api/v1/tasks/route";
import * as trash from "@/app/api/v1/trash/route";
import type { ErrorBody } from "@/server/errors";
import { BASE_URL } from "./helpers";

// Route modules differ in their params type ({ id } vs none), so they are stored loosely and
// called through RouteCall, the shape withUser actually accepts at runtime.
type Handler = (...args: never[]) => Promise<Response>;
type RouteCall = (req: Request, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type RouteModule = Partial<Record<Method, Handler>>;

// Static segments first so "/tasks/bulk" is not taken for "/tasks/:id".
const ROUTES: [RegExp, RouteModule][] = [
  [/^\/tasks$/, tasks],
  [/^\/tasks\/bulk$/, tasksBulk],
  [/^\/tasks\/([^/]+)$/, task],
  [/^\/tasks\/([^/]+)\/restore$/, taskRestore],
  [/^\/tasks\/([^/]+)\/move$/, taskMove],
  [/^\/trash$/, trash],
  [/^\/projects$/, projects],
  [/^\/projects\/([^/]+)$/, project],
  [/^\/projects\/([^/]+)\/restore$/, projectRestore],
  [/^\/projects\/([^/]+)\/progress$/, projectProgress],
  [/^\/boards\/([^/]+)$/, board],
  [/^\/boards\/([^/]+)\/columns$/, boardColumns],
  [/^\/columns\/([^/]+)$/, column],
  [/^\/columns\/([^/]+)\/move$/, columnMove],
  [/^\/labels$/, labels],
  [/^\/labels\/([^/]+)$/, label],
];

export type TestUser = { id: string; cookie: string };
export type ApiResponse<T> = { status: number; body: T };

/** The caller states the expected body type; error bodies are read with errorCode(). */
export async function api<T = unknown>(
  user: TestUser,
  method: Method,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const [pathname] = path.split("?");
  for (const [pattern, module] of ROUTES) {
    const match = pattern.exec(pathname);
    if (!match) continue;
    const handler = module[method];
    if (!handler) throw new Error(`${method} ${pathname} has no handler`);

    const headers = new Headers({ cookie: user.cookie, origin: BASE_URL });
    if (body !== undefined) headers.set("content-type", "application/json");
    const request = new Request(`${BASE_URL}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const params = match[1] ? { params: Promise.resolve({ id: match[1] }) } : undefined;
    const response = await (handler as RouteCall)(request, params);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }
  throw new Error(`No route for ${pathname}`);
}

/** Error code of a failed response (docs/05 section 1.1). */
export function errorCode(response: ApiResponse<unknown>): string | undefined {
  return (response.body as ErrorBody | null)?.error?.code;
}
