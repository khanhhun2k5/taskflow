// Error codes and HTTP statuses: docs/05-api-spec.md section 1.1.
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  WIP_LIMIT_EXCEEDED: 409,
  SPRINT_ALREADY_ACTIVE: 409,
  SPRINT_NOT_ACTIVE: 409,
  LABEL_EXISTS: 409,
  ESTIMATE_REQUIRED: 422,
  BOARD_NEEDS_TODO_AND_DONE: 422,
  SUBTASK_DEPTH_EXCEEDED: 422,
  INVALID_RECURRENCE_RULE: 422,
  PROJECT_ARCHIVED: 422,
  TASK_ON_BOARD: 422,
  PARENT_DELETED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = ERROR_STATUS[code];
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  init?: ResponseInit,
): Response {
  return Response.json(errorBody(code, message, details), { ...init, status: ERROR_STATUS[code] });
}
