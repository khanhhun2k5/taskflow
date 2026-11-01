import { ZodError } from "zod";
import { auth } from "@/server/auth";
import { AppError, errorResponse } from "@/server/errors";

type RouteParams = Record<string, string | string[] | undefined>;

export type UserContext<P extends RouteParams> = {
  userId: string;
  params: P;
};

type Handler<P extends RouteParams> = (
  req: Request,
  ctx: UserContext<P>,
) => Promise<Response | object> | Response | object;

type NextRouteContext<P extends RouteParams> = { params: Promise<P> };

// NFR-63: structured log line; never log bodies, cookies or tokens (NFR-12).
function logRequest(entry: {
  path: string;
  method: string;
  status: number;
  durationMs: number;
  userId: string | null;
  error?: string;
}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  if (entry.status >= 500) console.error(line);
  else console.log(line);
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return errorResponse("VALIDATION_ERROR", "Invalid input", details);
  }
  // Body that is not valid JSON (thrown by req.json()).
  if (error instanceof SyntaxError) {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON");
  }
  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.details);
  }
  // NFR-18: no stack trace or SQL in the response.
  return errorResponse("INTERNAL_ERROR", "Internal server error");
}

/**
 * Wraps a Route Handler: resolves the session (401 if missing), runs the handler,
 * and maps ZodError/AppError to the error format in docs/05-api-spec.md section 1.1.
 */
export function withUser<P extends RouteParams = Record<string, never>>(handler: Handler<P>) {
  return async (req: Request, routeCtx?: NextRouteContext<P>): Promise<Response> => {
    const startedAt = performance.now();
    const path = new URL(req.url).pathname;
    let userId: string | null = null;
    let response: Response;
    let internalError: string | undefined;

    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        response = errorResponse("UNAUTHENTICATED", "Authentication required");
      } else {
        userId = session.user.id;
        const params = routeCtx ? await routeCtx.params : ({} as P);
        const result = await handler(req, { userId, params });
        response = result instanceof Response ? result : Response.json(result);
      }
    } catch (error) {
      response = toErrorResponse(error);
      if (response.status >= 500) {
        internalError = error instanceof Error ? error.name : "UnknownError";
      }
    }

    logRequest({
      path,
      method: req.method,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      userId,
      error: internalError,
    });
    return response;
  };
}
