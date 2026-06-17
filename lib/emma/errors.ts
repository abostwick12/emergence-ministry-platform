import type { EmmaErrorCode, EmmaErrorShape, EmmaResponse } from "./types";

// EMMA error type. Carries a stable code and a human-readable message that is
// safe to surface to the client. It deliberately does NOT serialize causes,
// stack traces, provider payloads, or any context — those may contain secrets
// or sensitive ministry data and must never cross the API boundary.

export class EmmaError extends Error {
  readonly code: EmmaErrorCode;

  constructor(code: EmmaErrorCode, message: string) {
    super(message);
    this.name = "EmmaError";
    this.code = code;
    // Maintains correct prototype chain when targeting older JS.
    Object.setPrototypeOf(this, EmmaError.prototype);
  }

  /** Safe, serializable shape — code + message only. */
  toShape(): EmmaErrorShape {
    return { code: this.code, message: this.message };
  }
}

// Convenience constructors for the common cases.
export const emmaErrors = {
  validation: (message = "Invalid EMMA request.") => new EmmaError("VALIDATION_ERROR", message),
  unknownWorkflow: (message = "Unknown EMMA workflow.") => new EmmaError("UNKNOWN_WORKFLOW", message),
  workflowDisabled: (message = "This EMMA workflow is not enabled yet.") => new EmmaError("WORKFLOW_DISABLED", message),
  unauthorized: (message = "Authentication required.") => new EmmaError("UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to perform this action.") => new EmmaError("FORBIDDEN", message),
  ministryScope: (message = "Record is outside your ministry scope.") => new EmmaError("MINISTRY_SCOPE_ERROR", message),
  notFound: (message = "Record not found.") => new EmmaError("NOT_FOUND", message),
  conflict: (message = "Record is not in a valid state for this action.") => new EmmaError("CONFLICT", message),
  restrictedContext: (message = "Restricted or sensitive context cannot be processed.") =>
    new EmmaError("RESTRICTED_CONTEXT", message),
  internal: (message = "Unexpected EMMA error.") => new EmmaError("INTERNAL", message)
};

/**
 * Normalizes any thrown value into a safe EmmaErrorShape. Unknown errors are
 * collapsed to a generic INTERNAL error so raw messages (which may embed secrets
 * or provider details) never reach the client.
 */
export function toEmmaErrorShape(error: unknown): EmmaErrorShape {
  if (error instanceof EmmaError) {
    return error.toShape();
  }
  return { code: "INTERNAL", message: "Unexpected EMMA error." };
}

/** Wraps a successful value in an EmmaResponse. */
export function emmaOk<T>(data: T): EmmaResponse<T> {
  return { ok: true, data };
}

/** Wraps any thrown value in a failed EmmaResponse with a safe error shape. */
export function emmaFail<T = never>(error: unknown): EmmaResponse<T> {
  return { ok: false, error: toEmmaErrorShape(error) };
}
