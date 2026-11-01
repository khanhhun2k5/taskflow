// Typed fetch for /api/v1/* (ADR-06). Errors follow docs/05 section 1.1 and become ApiError.
// Client-only codes: NETWORK_ERROR (request never reached the server).

export const API_BASE = "/api/v1";

/** Codes worth a "Retry" button (NFR-51): transient failures, not business rules. */
const RETRYABLE = new Set(["NETWORK_ERROR", "INTERNAL_ERROR", "CONFLICT", "RATE_LIMITED"]);

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRetryable(error: unknown): boolean {
  return !isApiError(error) || RETRYABLE.has(error.code) || error.status >= 500;
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  if (error && typeof error.code === "string") {
    const message = typeof error.message === "string" ? error.message : error.code;
    return new ApiError(error.code, message, response.status, error.details);
  }
  return new ApiError("INTERNAL_ERROR", `HTTP ${response.status}`, response.status);
}

/** `path` is relative to /api/v1, e.g. "/tasks?inbox=true". 204 resolves to undefined. */
export async function apiFetch<T>(path: string, { method = "GET", body, signal }: ApiOptions = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", "Network request failed", 0);
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Query string from defined values only: { inbox: true, limit: 200 } → "?inbox=true&limit=200". */
export function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
